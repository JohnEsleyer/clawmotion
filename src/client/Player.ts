import { ClawEngine } from '../core/Engine';
import { PostProcessor } from './PostProcessor';

export class ClawPlayer {
    private container: HTMLElement;
    private canvas2d: HTMLCanvasElement; // Hidden rendering canvas
    private ctx2d: CanvasRenderingContext2D;
    private postProcessor: PostProcessor;
    private engine: ClawEngine;

    private isPlaying: boolean = false;
    private startTime: number = 0;
    private currentTick: number = 0;
    private animationFrameId: number | null = null;

    constructor(container: HTMLElement | string, engine: ClawEngine) {
        if (typeof container === 'string') {
            const el = document.querySelector(container);
            if (!el) throw new Error(`Container not found: ${container}`);
            this.container = el as HTMLElement;
        } else {
            this.container = container;
        }

        this.engine = engine;

        // 1. Setup 2D Rendering Canvas (Hidden)
        this.canvas2d = document.createElement('canvas');
        this.canvas2d.width = engine.config.width;
        this.canvas2d.height = engine.config.height;
        const context = this.canvas2d.getContext('2d');
        if (!context) throw new Error('Could not get 2D context');
        this.ctx2d = context;

        // 2. Setup PostProcessor and add its canvas to the DOM
        this.postProcessor = new PostProcessor(engine.config.width, engine.config.height);
        this.container.appendChild(this.postProcessor.getCanvas());

        // Initial render
        this.render();
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

    public seek(tick: number) {
        this.currentTick = Math.max(0, tick);
        this.render();
    }

    public seekToTime(seconds: number) {
        this.seek(this.engine.toTicks(seconds));
    }

    private loop = () => {
        if (!this.isPlaying) return;

        const now = performance.now();
        const elapsed = (now - this.startTime) / 1000; // seconds
        const expectedTick = Math.floor(elapsed * this.engine.config.fps);

        if (expectedTick > this.currentTick) {
            this.currentTick = expectedTick;
            this.render();
        }

        if (this.currentTick >= this.engine.toTicks(this.engine.config.duration)) {
            this.pause();
            return; // Stop at end
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    };

    private render() {
        this.engine.render(this.currentTick, this.ctx2d);

        // Apply Post-Processing
        const effects = (this.engine.config as any).effects || {};
        this.postProcessor.render(this.canvas2d, effects);

        // Sync Audio if available
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
}
