import { BlueprintRegistry } from './Blueprint';
import { BlueprintContext } from './Context';
import { ClawMath } from './Math';

export interface ClawConfig {
    width: number;
    height: number;
    fps: number;
    duration: number; // in seconds
    debug?: boolean;
}

export interface Transition {
    type: 'fade' | 'slide' | 'zoom';
    durationTicks: number;
}

export interface Clip {
    id: string;
    blueprintId: string;
    startTick: number; // Start frame
    durationTicks: number; // Length in frames
    layer?: number;
    props?: Record<string, any>;
    entry?: Transition;
    exit?: Transition;
}

export class ClawEngine {
    public config: ClawConfig;
    public registry: BlueprintRegistry;
    public clips: Clip[] = [];
    public audioData: Map<string, any[]> = new Map(); // trackId -> Array of FrameData
    public assets: Map<string, any> = new Map();

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
     * Render a specific frame.
     * @param tick The frame number to render.
     * @param ctx The drawing context (Canvas2D or WebGL).
     */
    public render(tick: number, ctx: any) {
        // Clear canvas (assuming 2D for now, but abstracting later)
        if (ctx.clearRect) {
            ctx.clearRect(0, 0, this.config.width, this.config.height);
        } else if (ctx.clear) {
            // WebGL clear logic would go here
            // gl.clear(gl.COLOR_BUFFER_BIT);
        }

        // Find and sort active clips
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

            const context: BlueprintContext = {
                ctx,
                tick,
                width: this.config.width,
                height: this.config.height,
                localTime,
                utils: this.math,
                audio,
                props: clip.props || {},
                getAsset: (id: string) => this.assets.get(id)
            };

            blueprint(context);
            ctx.restore();
        }
    }

    /**
     * Convert seconds to ticks.
     */
    public toTicks(seconds: number): number {
        return Math.floor(seconds * this.config.fps);
    }
}
