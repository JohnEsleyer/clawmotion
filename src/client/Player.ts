import { ClawEngine, Clip } from '../core/Engine';
import { PostProcessor } from './PostProcessor';
import { Compositor, LayerData } from './Compositor';

export class ClawPlayer {
    private container: HTMLElement;
    private layerCanvases: Map<string, HTMLCanvasElement> = new Map();
    private compositor: Compositor;
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

        // 1. Setup Compositor (WebGL)
        this.compositor = new Compositor(engine.config.width, engine.config.height);

        // 2. Setup PostProcessor and add its canvas to the DOM
        this.postProcessor = new PostProcessor(engine.config.width, engine.config.height);
        this.container.appendChild(this.postProcessor.getCanvas());

        // Initial render
        this.render();
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

    private async render() {
        // 1. Identify active video clips and seek them
        const activeClips = this.engine.clips.filter(c =>
            this.currentTick >= c.startTick &&
            this.currentTick < (c.startTick + c.durationTicks)
        );

        const videoSyncs = activeClips.map(async (clip) => {
            const blueprint = this.engine.registry.get(clip.blueprintId);
            if (clip.blueprintId === 'video' || (clip.props?.assetId && clip.props.assetId.endsWith('.mp4'))) {
                const video = this.engine.assets.get(clip.props?.assetId) as HTMLVideoElement;
                if (video && video.tagName === 'VIDEO') {
                    const localTick = this.currentTick - clip.startTick;
                    const targetTime = localTick / this.engine.config.fps;

                    if (Math.abs(video.currentTime - targetTime) > 0.001) {
                        return new Promise<void>((resolve) => {
                            video.onseeked = () => resolve();
                            video.currentTime = targetTime;
                        });
                    }
                }
            }
        });

        await Promise.all(videoSyncs);

        // 2. Render all active clips into their own canvases
        const layerData = this.engine.renderToLayers(this.currentTick, (clip: Clip) => {
            const canvas = this.getOrLayerCanvas(clip.id);
            return canvas.getContext('2d');
        });

        // 3. Composite layers using WebGL
        const compositeLayers: LayerData[] = layerData.map(l => ({
            source: this.layerCanvases.get(l!.clip.id)!,
            opacity: l!.opacity,
            blendMode: l!.clip.blendMode || 'normal',
            transform: l!.transform
        }));

        this.compositor.composite(compositeLayers);

        // 4. Apply Post-Processing to the composited result
        const effects = (this.engine.config as any).effects || {};
        this.postProcessor.render(this.compositor.getCanvas(), effects);

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
