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

    private async renderWithInternalCanvas() {
        if (!this.engine.canvas || !this.engine.ctx) {
            await this.engine.init();
        }

        this.engine.renderToInternalCanvas(this.currentTick);

        const canvas = this.engine.canvas as any;
        if (canvas.transferToImageBitmap) {
            const bitmap = canvas.transferToImageBitmap();
            if (!this.previewCanvas) {
                this.previewCanvas = document.createElement('canvas');
                this.previewCanvas.width = this.engine.config.width;
                this.previewCanvas.height = this.engine.config.height;
                this.container.innerHTML = '';
                this.container.appendChild(this.previewCanvas);
            }
            const ctx = this.previewCanvas.getContext('2d');
            if (ctx) {
                (ctx as any).transferFromImageBitmap(bitmap);
            }
        } else if (canvas.rawCanvas) {
            if (!this.previewCanvas) {
                this.previewCanvas = document.createElement('canvas');
                this.previewCanvas.width = this.engine.config.width;
                this.previewCanvas.height = this.engine.config.height;
                this.container.innerHTML = '';
                this.container.appendChild(this.previewCanvas);
            }
            const ctx = this.previewCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(canvas.rawCanvas, 0, 0);
            }
        }
    }

    private async render() {
        if (this.engine.canvas && this.engine.ctx) {
            await this.renderWithInternalCanvas();
            return;
        }

        const activeClips = this.engine.clips.filter(c =>
            this.currentTick >= c.startTick &&
            this.currentTick < (c.startTick + c.durationTicks)
        );

        const videoSyncs = activeClips.map(async (clip) => {
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
}
