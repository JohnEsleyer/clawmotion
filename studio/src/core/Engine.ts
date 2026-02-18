export interface CameraConfig {
    x?: number;
    y?: number;
    zoom?: number;
    shake?: number;
}

export interface ClawConfig {
    width: number;
    height: number;
    fps: number;
    duration: number;
    debug?: boolean;
    camera?: CameraConfig;
    effects?: {
        bloom?: number;
        chromatic?: number;
        vignette?: number;
    };
    concurrency?: number;
}

export interface Transition {
    type: 'fade' | 'slide' | 'zoom';
    durationTicks: number;
}

export interface Keyframe {
    tick: number;
    value: any;
    easing?: string;
}

export interface Clip {
    id: string;
    blueprintId: string;
    startTick: number;
    durationTicks: number;
    layer?: number;
    props?: Record<string, any>;
    animations?: Record<string, Keyframe[]>;
    entry?: Transition;
    exit?: Transition;
    blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
}

export interface BlueprintContext {
    ctx: CanvasRenderingContext2D;
    time: number;
    tick: number;
    width: number;
    height: number;
    localTime: number;
    utils: any;
    audio?: any;
    props?: Record<string, any>;
    getAsset?: (id: string) => any;
}

export type BlueprintFn = (ctx: BlueprintContext) => void;

export class BlueprintRegistry {
    private blueprints: Map<string, BlueprintFn> = new Map();
    
    register(id: string, fn: BlueprintFn): void {
        this.blueprints.set(id, fn);
    }
    
    get(id: string): BlueprintFn | undefined {
        return this.blueprints.get(id);
    }
    
    has(id: string): boolean {
        return this.blueprints.has(id);
    }
}

export class ClawMath {
    easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    easeInOutCubic(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    range(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
    
    lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }
    
    clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
    
    map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    }
}

export const Easing = {
    linear: (t: number) => t,
    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (--t) * t * t + 1,
    easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

const easingFunctions: Record<string, (t: number) => number> = {
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

function resolveKeyframe(keyframes: Keyframe[], tick: number): any {
    if (!keyframes || keyframes.length === 0) return undefined;
    
    const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);
    
    if (tick <= sorted[0].tick) return sorted[0].value;
    if (tick >= sorted[sorted.length - 1].tick) return sorted[sorted.length - 1].value;
    
    for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i];
        const k2 = sorted[i + 1];
        
        if (tick >= k1.tick && tick <= k2.tick) {
            const t = (tick - k1.tick) / (k2.tick - k1.tick);
            const easing = k1.easing ? easingFunctions[k1.easing] : easingFunctions.linear;
            const easedT = easing(t);
            
            if (typeof k1.value === 'number' && typeof k2.value === 'number') {
                return k1.value + (k2.value - k1.value) * easedT;
            }
            return k1.value;
        }
    }
    
    return sorted[sorted.length - 1].value;
}

export class ClawEngine {
    public config: ClawConfig;
    public registry: BlueprintRegistry;
    public clips: Clip[] = [];
    public audioData: Map<string, any[]> = new Map();
    public assets: Map<string, any> = new Map();
    public cameraAnimations: Record<string, Keyframe[]> = {};

    public canvas: HTMLCanvasElement | null = null;
    public ctx: CanvasRenderingContext2D | null = null;

    private math: ClawMath;
    private _canvas: HTMLCanvasElement | null = null;

    constructor(config: ClawConfig) {
        this.config = config;
        this.registry = new BlueprintRegistry();
        this.math = new ClawMath();
    }

    public async init() {
        this._canvas = document.createElement('canvas');
        this._canvas.width = this.config.width;
        this._canvas.height = this.config.height;
        this.ctx = this._canvas.getContext('2d');
        this.canvas = this._canvas;
    }

    public setAudioData(trackId: string, frames: any[]) {
        this.audioData.set(trackId, frames);
    }

    public addClip(clip: Clip) {
        this.clips.push(clip);
        this.clips.sort((a, b) => (a.layer || 0) - (b.layer || 0) || a.startTick - b.startTick);
    }

    public renderToLayers(tick: number, getLayerCtx: (clip: Clip) => any) {
        const camera = { ...(this.config.camera || {}) };
        Object.entries(this.cameraAnimations).forEach(([prop, keyframes]) => {
            (camera as any)[prop] = resolveKeyframe(keyframes as Keyframe[], tick);
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

            let opacity = 1;
            let translateX = 0;
            let translateY = 0;
            let scale = 1;

            if (clip.entry && localTick < clip.entry.durationTicks) {
                const t = localTick / clip.entry.durationTicks;
                const eased = this.math.easeInOutQuad(t);
                if (clip.entry.type === 'fade') opacity = eased;
                if (clip.entry.type === 'slide') translateY = (1 - eased) * 50;
                if (clip.entry.type === 'zoom') scale = 0.9 + eased * 0.1;
            }

            const ticksRemaining = clip.durationTicks - localTick;
            if (clip.exit && ticksRemaining < clip.exit.durationTicks) {
                const t = ticksRemaining / clip.exit.durationTicks;
                const eased = this.math.easeInOutQuad(t);
                if (clip.exit.type === 'fade') opacity = Math.min(opacity, eased);
                if (clip.exit.type === 'slide') translateY = (1 - eased) * -50;
                if (clip.exit.type === 'zoom') scale *= (0.9 + eased * 0.1);
            }

            const resolvedProps = { ...(clip.props || {}) };
            if (clip.animations) {
                Object.entries(clip.animations).forEach(([prop, keyframes]) => {
                    resolvedProps[prop] = resolveKeyframe(keyframes as Keyframe[], localTick);
                });
            }

            const context: BlueprintContext = {
                ctx,
                time: tick / this.config.fps,
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

    public render(tick: number, ctx: any) {
        if (ctx.clearRect) {
            ctx.clearRect(0, 0, this.config.width, this.config.height);
        }

        ctx.save();

        const camera = { ...(this.config.camera || {}) };
        Object.entries(this.cameraAnimations).forEach(([prop, keyframes]) => {
            (camera as any)[prop] = resolveKeyframe(keyframes as Keyframe[], tick);
        });

        const zoom = camera.zoom || 1;
        const camX = camera.x || 0;
        const camY = camera.y || 0;
        const shake = camera.shake || 0;

        if (shake > 0) {
            const shakeX = Math.sin(tick * 1.5) * shake * 20;
            const shakeY = Math.cos(tick * 1.7) * shake * 20;
            ctx.translate(shakeX, shakeY);
        }

        if (zoom !== 1 || camX !== 0 || camY !== 0) {
            ctx.translate(this.config.width / 2, this.config.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-this.config.width / 2 + camX, -this.config.height / 2 + camY);
        }

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

            let opacity = 1;
            let translateX = 0;
            let translateY = 0;
            let scale = 1;

            if (clip.entry && localTick < clip.entry.durationTicks) {
                const t = localTick / clip.entry.durationTicks;
                const eased = this.math.easeInOutQuad(t);
                if (clip.entry.type === 'fade') opacity = eased;
                if (clip.entry.type === 'slide') translateY = (1 - eased) * 50;
                if (clip.entry.type === 'zoom') scale = 0.9 + eased * 0.1;
            }

            const ticksRemaining = clip.durationTicks - localTick;
            if (clip.exit && ticksRemaining < clip.exit.durationTicks) {
                const t = ticksRemaining / clip.exit.durationTicks;
                const eased = this.math.easeInOutQuad(t);
                if (clip.exit.type === 'fade') opacity = Math.min(opacity, eased);
                if (clip.exit.type === 'slide') translateY = (1 - eased) * -50;
                if (clip.exit.type === 'zoom') scale *= (0.9 + eased * 0.1);
            }

            ctx.globalAlpha = opacity;
            if (translateX !== 0 || translateY !== 0) {
                ctx.translate(translateX, translateY);
            }
            if (scale !== 1) {
                ctx.translate(this.config.width / 2, this.config.height / 2);
                ctx.scale(scale, scale);
                ctx.translate(-this.config.width / 2, -this.config.height / 2);
            }

            const resolvedProps = { ...(clip.props || {}) };
            if (clip.animations) {
                Object.entries(clip.animations).forEach(([prop, keyframes]) => {
                    resolvedProps[prop] = resolveKeyframe(keyframes as Keyframe[], localTick);
                });
            }

            const context: BlueprintContext = {
                ctx,
                time: tick / this.config.fps,
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

        ctx.restore();
    }

    public renderToInternalCanvas(tick: number) {
        if (!this.ctx || !this.canvas) {
            throw new Error("Engine not initialized. Call init() first.");
        }
        this.render(tick, this.ctx);
    }

    public getImageData(): ImageData | null {
        if (!this.ctx || !this.canvas) return null;
        return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    public toTicks(seconds: number): number {
        return Math.floor(seconds * this.config.fps);
    }
}

export interface LayerData {
    source: HTMLCanvasElement;
    opacity: number;
    blendMode: string;
    transform: { translateX: number; translateY: number; scale: number };
}

export class Compositor {
    private width: number;
    private height: number;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d')!;
    }

    public composite(layers: LayerData[]) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        for (const layer of layers) {
            this.ctx.save();
            this.ctx.globalAlpha = layer.opacity;
            this.ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
            
            const { translateX, translateY, scale } = layer.transform;
            if (translateX !== 0 || translateY !== 0 || scale !== 1) {
                this.ctx.translate(this.width / 2, this.height / 2);
                this.ctx.scale(scale, scale);
                this.ctx.translate(-this.width / 2 + translateX, -this.height / 2 + translateY);
            }
            
            this.ctx.drawImage(layer.source, 0, 0);
            this.ctx.restore();
        }
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }
}

export class PostProcessor {
    private width: number;
    private height: number;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d')!;
    }

    public render(source: HTMLCanvasElement, effects: any = {}) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (effects.bloom || effects.chromatic || effects.vignette) {
            this.ctx.drawImage(source, 0, 0);
            
            if (effects.chromatic) {
                this.ctx.globalCompositeOperation = 'screen';
                this.ctx.drawImage(source, -2, 0);
                this.ctx.globalCompositeOperation = 'multiply';
                this.ctx.drawImage(source, 2, 0);
                this.ctx.globalCompositeOperation = 'source-over';
            }
            
            if (effects.vignette) {
                const gradient = this.ctx.createRadialGradient(
                    this.width / 2, this.height / 2, 0,
                    this.width / 2, this.height / 2, Math.max(this.width, this.height) / 1.5
                );
                gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
                gradient.addColorStop(1, `rgba(0,0,0,${effects.vignette})`);
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, this.width, this.height);
            }
        } else {
            this.ctx.drawImage(source, 0, 0);
        }
    }

    public getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }
}

export class ClawPlayer {
    private container: HTMLElement;
    private layerCanvases: Map<string, HTMLCanvasElement> = new Map();
    private compositor: Compositor;
    private postProcessor: PostProcessor;
    private engine: ClawEngine;

    private isPlaying: boolean = false;
    private startTime: number = 0;
    public currentTick: number = 0;
    private animationFrameId: number | null = null;
    private previewCanvas: HTMLCanvasElement | null = null;

    constructor(container: HTMLElement | string, engine: ClawEngine) {
        if (typeof container === 'string') {
            const el = document.querySelector(container);
            if (!el) throw new Error(`Container not found: ${container}`);
            this.container = el as HTMLElement;
        } else {
            this.container = container;
        }

        this.engine = engine;
        this.compositor = new Compositor(engine.config.width, engine.config.height);
        this.postProcessor = new PostProcessor(engine.config.width, engine.config.height);
        
        const outputCanvas = this.postProcessor.getCanvas();
        outputCanvas.style.display = 'block';
        outputCanvas.style.width = '100%';
        outputCanvas.style.height = 'auto';
        outputCanvas.style.maxWidth = '100%';
        outputCanvas.style.maxHeight = '100%';
        outputCanvas.style.objectFit = 'contain';
        outputCanvas.style.imageRendering = 'auto';
        this.container.style.display = 'flex';
        this.container.style.alignItems = 'center';
        this.container.style.justifyContent = 'center';
        this.container.appendChild(outputCanvas);

        this.render();
    }

    public async init() {
        await this.engine.init();
    }

    private getOrLayerCanvas(id: string): HTMLCanvasElement {
        if (!this.layerCanvases.has(id)) {
            const canvas = document.createElement('canvas');
            canvas.width = this.engine.config.width;
            canvas.height = this.engine.config.height;
            this.layerCanvases.set(id, canvas);
        }
        return this.layerCanvases.get(id)!;
    }

    public play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.startTime = performance.now() - (this.currentTick / this.engine.config.fps) * 1000;
        this.loop();
    }

    public pause() {
        this.isPlaying = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    public async seek(tick: number) {
        this.currentTick = Math.max(0, tick);
        await this.render();
    }

    public async seekToTime(seconds: number) {
        await this.seek(this.engine.toTicks(seconds));
    }

    private loop = () => {
        if (!this.isPlaying) return;

        const now = performance.now();
        const elapsed = (now - this.startTime) / 1000;
        const expectedTick = Math.floor(elapsed * this.engine.config.fps);

        if (expectedTick > this.currentTick) {
            this.currentTick = expectedTick;
            this.render();
        }

        if (this.currentTick >= this.engine.toTicks(this.engine.config.duration)) {
            this.pause();
            return;
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    };

    private async render() {
        if (this.engine.canvas && this.engine.ctx) {
            await this.renderWithInternalCanvas();
            return;
        }

        const activeClips = this.engine.clips.filter(c =>
            this.currentTick >= c.startTick &&
            this.currentTick < (c.startTick + c.durationTicks)
        );

        const layerData = this.engine.renderToLayers(this.currentTick, (clip: Clip) => {
            const canvas = this.getOrLayerCanvas(clip.id);
            return canvas.getContext('2d');
        });

        const compositeLayers: LayerData[] = layerData.map(l => ({
            source: this.layerCanvases.get(l!.clip.id)!,
            opacity: l!.opacity,
            blendMode: l!.clip.blendMode || 'normal',
            transform: l!.transform
        }));

        this.compositor.composite(compositeLayers);

        const effects = (this.engine.config as any).effects || {};
        this.postProcessor.render(this.compositor.getCanvas(), effects);

        const audioAsset = this.engine.assets.get('main-audio') as HTMLAudioElement;
        if (audioAsset) {
            if (this.isPlaying) {
                const expectedTime = this.currentTick / this.engine.config.fps;
                if (Math.abs(audioAsset.currentTime - expectedTime) > 0.1) {
                    audioAsset.currentTime = expectedTime;
                }
                if (audioAsset.paused) audioAsset.play().catch(() => { });
            } else {
                audioAsset.pause();
                audioAsset.currentTime = this.currentTick / this.engine.config.fps;
            }
        }
    }

    private async renderWithInternalCanvas() {
        if (!this.engine.canvas || !this.engine.ctx) {
            await this.engine.init();
        }

        this.engine.renderToInternalCanvas(this.currentTick);

        const canvas = this.engine.canvas;
        if (!this.previewCanvas) {
            this.previewCanvas = document.createElement('canvas');
            this.previewCanvas.width = this.engine.config.width;
            this.previewCanvas.height = this.engine.config.height;
            this.container.innerHTML = '';
            this.container.appendChild(this.previewCanvas);
        }
        const ctx = this.previewCanvas.getContext('2d');
        if (ctx && canvas) {
            ctx.drawImage(canvas, 0, 0);
        }
    }
}
