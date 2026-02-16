import { BlueprintRegistry } from './Blueprint';
import { BlueprintContext } from './Context';
import { ClawMath, Easing } from './Math';
import { ClawAnimator } from './Animator';

export interface CameraConfig {
    x?: number;
    y?: number;
    zoom?: number;
    shake?: number; // Intensity of screen shake (0-1)
}

export interface ClawConfig {
    width: number;
    height: number;
    fps: number;
    duration: number; // in seconds
    debug?: boolean;
    camera?: CameraConfig;
    effects?: {
        bloom?: number;
        chromatic?: number;
        vignette?: number;
    };
}

export interface Transition {
    type: 'fade' | 'slide' | 'zoom';
    durationTicks: number;
}

export interface Keyframe {
    tick: number; // Local tick within the clip (0 to durationTicks)
    value: any;
    easing?: keyof typeof Easing;
}

export interface Clip {
    id: string;
    blueprintId: string;
    startTick: number; // Start frame
    durationTicks: number; // Length in frames
    layer?: number;
    props?: Record<string, any>;
    animations?: Record<string, Keyframe[]>;
    entry?: Transition;
    exit?: Transition;
    blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
}

export class ClawEngine {
    public config: ClawConfig;
    public registry: BlueprintRegistry;
    public clips: Clip[] = [];
    public audioData: Map<string, any[]> = new Map(); // trackId -> Array of FrameData
    public assets: Map<string, any> = new Map();
    public cameraAnimations: Record<string, Keyframe[]> = {};

    private math: ClawMath;

    constructor(config: ClawConfig) {
        this.config = config;
        this.registry = new BlueprintRegistry();
        this.math = new ClawMath();
    }

    /**
     * Set audio data for a specific track.
     */
    public setAudioData(trackId: string, frames: any[]) {
        this.audioData.set(trackId, frames);
    }

    /**
     * Add a clip to the timeline.
     */
    public addClip(clip: Clip) {
        this.clips.push(clip);
        // Sort by layer then by start time
        this.clips.sort((a, b) => (a.layer || 0) - (b.layer || 0) || a.startTick - b.startTick);
    }

    /**
     * Render each active clip into its own layer.
     * @param tick The frame number.
     * @param getLayerCtx A function that returns a context for a specific clip.
     */
    public renderToLayers(tick: number, getLayerCtx: (clip: Clip) => any) {
        // Resolve camera animations (global for now, but could be passed to layers)
        const camera = { ...(this.config.camera || {}) };
        Object.entries(this.cameraAnimations).forEach(([prop, keyframes]) => {
            // @ts-ignore
            camera[prop] = ClawAnimator.resolve(keyframes, tick);
        });

        const activeClips = this.clips
            .filter(c => tick >= c.startTick && tick < (c.startTick + c.durationTicks))
            .sort((a, b) => (a.layer || 0) - (b.layer || 0));

        const layerResults = activeClips.map(clip => {
            const ctx = getLayerCtx(clip);
            if (ctx.clearRect) {
                ctx.clearRect(0, 0, this.config.width, this.config.height);
            }

            const blueprint = this.registry.get(clip.blueprintId);
            if (!blueprint) return null;

            const localTick = tick - clip.startTick;
            const localTime = localTick / clip.durationTicks;
            const mainAudio = this.audioData.get('main');
            const audio = mainAudio ? mainAudio[tick] : undefined;

            ctx.save();

            // --- Automatic Transition Handling ---
            let opacity = 1;
            let translateX = 0;
            let translateY = 0;
            let scale = 1;

            // Entry
            if (clip.entry && localTick < clip.entry.durationTicks) {
                const t = localTick / clip.entry.durationTicks;
                const eased = this.math.easeInOutQuad(t);
                if (clip.entry.type === 'fade') opacity = eased;
                if (clip.entry.type === 'slide') translateY = (1 - eased) * 50;
                if (clip.entry.type === 'zoom') scale = 0.9 + eased * 0.1;
            }

            // Exit
            const ticksRemaining = clip.durationTicks - localTick;
            if (clip.exit && ticksRemaining < clip.exit.durationTicks) {
                const t = ticksRemaining / clip.exit.durationTicks;
                const eased = this.math.easeInOutQuad(t);
                if (clip.exit.type === 'fade') opacity = Math.min(opacity, eased);
                if (clip.exit.type === 'slide') translateY = (1 - eased) * -50;
                if (clip.exit.type === 'zoom') scale *= (0.9 + eased * 0.1);
            }

            // Merge static props with animated properties
            const resolvedProps = { ...(clip.props || {}) };
            if (clip.animations) {
                Object.entries(clip.animations).forEach(([prop, keyframes]) => {
                    resolvedProps[prop] = ClawAnimator.resolve(keyframes, localTick);
                });
            }

            const context: BlueprintContext = {
                ctx,
                tick,
                width: this.config.width,
                height: this.config.height,
                localTime,
                utils: this.math,
                audio,
                props: resolvedProps,
                getAsset: (id: string) => this.assets.get(id)
            };

            blueprint(context);
            ctx.restore();

            return {
                clip,
                opacity,
                transform: { translateX, translateY, scale }
            };
        });

        return layerResults.filter(l => l !== null);
    }

    /**
     * Render a specific frame.
     * @param tick The frame number to render.
     * @param ctx The drawing context (Canvas2D or WebGL).
     */
    public render(tick: number, ctx: any) {
        // 2. Clear canvas
        if (ctx.clearRect) {
            ctx.clearRect(0, 0, this.config.width, this.config.height);
        }

        // 3. Global Camera & Transformations
        ctx.save();

        // Resolve camera animations
        const camera = { ...(this.config.camera || {}) };
        Object.entries(this.cameraAnimations).forEach(([prop, keyframes]) => {
            // @ts-ignore
            camera[prop] = ClawAnimator.resolve(keyframes, tick);
        });

        const zoom = camera.zoom || 1;
        const camX = camera.x || 0;
        const camY = camera.y || 0;
        const shake = camera.shake || 0;

        // Apply Shake (Deterministic)
        if (shake > 0) {
            // Using a high-frequency sine based on tick for deterministic "rumble"
            const shakeX = Math.sin(tick * 1.5) * shake * 20;
            const shakeY = Math.cos(tick * 1.7) * shake * 20;
            ctx.translate(shakeX, shakeY);
        }

        // Apply Pan & Zoom
        if (zoom !== 1 || camX !== 0 || camY !== 0) {
            ctx.translate(this.config.width / 2, this.config.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-this.config.width / 2 + camX, -this.config.height / 2 + camY);
        }

        // 4. Find and sort active clips
        const activeClips = this.clips
            .filter(c => tick >= c.startTick && tick < (c.startTick + c.durationTicks))
            .sort((a, b) => (a.layer || 0) - (b.layer || 0));

        for (const clip of activeClips) {
            const blueprint = this.registry.get(clip.blueprintId);
            if (!blueprint) continue;

            const localTick = tick - clip.startTick;
            const localTime = localTick / clip.durationTicks;
            const mainAudio = this.audioData.get('main');
            const audio = mainAudio ? mainAudio[tick] : undefined;

            ctx.save();

            // --- Automatic Transition Handling ---
            let opacity = 1;
            let translateX = 0;
            let translateY = 0;
            let scale = 1;

            // Entry
            if (clip.entry && localTick < clip.entry.durationTicks) {
                const t = localTick / clip.entry.durationTicks;
                const eased = this.math.easeInOutQuad(t);

                if (clip.entry.type === 'fade') opacity = eased;
                if (clip.entry.type === 'slide') translateY = (1 - eased) * 50;
                if (clip.entry.type === 'zoom') scale = 0.9 + eased * 0.1;
            }

            // Exit
            const ticksRemaining = clip.durationTicks - localTick;
            if (clip.exit && ticksRemaining < clip.exit.durationTicks) {
                const t = ticksRemaining / clip.exit.durationTicks;
                const eased = this.math.easeInOutQuad(t);

                if (clip.exit.type === 'fade') opacity = Math.min(opacity, eased);
                if (clip.exit.type === 'slide') translateY = (1 - eased) * -50;
                if (clip.exit.type === 'zoom') scale *= (0.9 + eased * 0.1);
            }

            // Apply state
            ctx.globalAlpha = opacity;
            if (translateX !== 0 || translateY !== 0) {
                ctx.translate(translateX, translateY);
            }
            if (scale !== 1) {
                ctx.translate(this.config.width / 2, this.config.height / 2);
                ctx.scale(scale, scale);
                ctx.translate(-this.config.width / 2, -this.config.height / 2);
            }

            // Merge static props with animated properties
            const resolvedProps = { ...(clip.props || {}) };
            if (clip.animations) {
                Object.entries(clip.animations).forEach(([prop, keyframes]) => {
                    resolvedProps[prop] = ClawAnimator.resolve(keyframes, localTick);
                });
            }

            const context: BlueprintContext = {
                ctx,
                tick,
                width: this.config.width,
                height: this.config.height,
                localTime,
                utils: this.math,
                audio,
                props: resolvedProps,
                getAsset: (id: string) => this.assets.get(id)
            };

            blueprint(context);
            ctx.restore();
        }

        // Restore global camera
        ctx.restore();
    }

    /**
     * Convert seconds to ticks.
     */
    public toTicks(seconds: number): number {
        return Math.floor(seconds * this.config.fps);
    }
}
