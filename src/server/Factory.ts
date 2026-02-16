import { ClawConfig, ClawEngine, Clip } from '../core/Engine';
import { PuppeteerBridge } from './PuppeteerBridge';
import express from 'express';
import * as http from 'http';
import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

export class MotionFactory {
    private server: http.Server | null = null;
    private bridge: PuppeteerBridge;
    private port = 3001;

    constructor() {
        this.bridge = new PuppeteerBridge();
    }

    /**
     * Bundle client code and start a local server.
     */
    private async startServer() {
        // 1. Bundle Client Code
        console.log('[Factory] Bundling client code with esbuild...');
        try {
            await esbuild.build({
                entryPoints: [path.join(__dirname, '../client/index.ts')],
                bundle: true,
                outfile: path.join(__dirname, '../../dist/bundle.js'),
                // globalName: 'ClawMotion', // Removing globalName to ensure side-effects (window assignment) run directly
                platform: 'browser',
            });
            console.log('[Factory] Bundling complete.');
        } catch (e) {
            console.error('[Factory] Bundling failed:', e);
            throw e;
        }

        // 2. Start Express
        console.log('[Factory] Starting Express server...');
        const app = express();
        const staticPath = path.join(__dirname, '../../dist');
        app.use(express.static(staticPath));

        app.get('/', (req, res) => {
            const htmlPath = path.join(__dirname, './preview.html');
            if (fs.existsSync(htmlPath)) {
                res.sendFile(htmlPath);
            } else {
                // Fallback if file not found (e.g., specific build structure)
                res.send('<html><body><h1>Error: preview.html not found</h1></body></html>');
            }
        });

        return new Promise<void>((resolve, reject) => {
            this.server = app.listen(this.port, '0.0.0.0', () => {
                console.log(`[Factory] Renderer server started at http://localhost:${this.port}`);
                resolve();
            }).on('error', (err) => {
                console.error('[Factory] Server failed to start:', err);
                reject(err);
            });
        });
    }

    /**
     * Render the video to a file.
     */
    public async render(config: ClawConfig, clips: Clip[], outputPath: string, audioData?: any, images?: Record<string, string>, onTick?: (tick: number) => void) {
        await this.startServer();

        // Launch Browser
        const response = await this.bridge.launch(`http://127.0.0.1:${this.port}`, config.width, config.height);
        if (!response?.ok()) {
            throw new Error(`[Factory] Navigation failed: ${response?.status()} ${response?.statusText()}`);
        }
        console.log('[Factory] Puppeteer connected.');

        // Initialize Player in Browser
        const page = this.bridge['page'] as any;
        await page.evaluate(async (conf: any, clipList: any, audio: any, imageMap: any) => {
            // @ts-ignore
            if (!window.ClawEngine) throw new Error("ClawEngine not found on window");
            // @ts-ignore
            const engine = new window.ClawEngine(conf);
            // @ts-ignore
            const loader = new window.AssetLoader();

            // 1. Load Images
            if (imageMap) {
                for (const [id, url] of Object.entries(imageMap)) {
                    const img = await loader.loadImage(url);
                    engine.assets.set(id, img);
                }
            }

            // 2. Inject audio data
            if (audio) {
                Object.entries(audio).forEach(([id, frames]) => {
                    engine.setAudioData(id, frames as any[]);
                });
            }

            // 3. Register Blueprints
            // @ts-ignore
            if (window.PredefinedBlueprints) {
                // @ts-ignore
                Object.entries(window.PredefinedBlueprints).forEach(([id, bp]) => {
                    engine.registry.register(id, bp);
                });
            }

            clipList.forEach((c: any) => engine.addClip(c));
            // @ts-ignore
            const player = new window.ClawPlayer('#preview', engine);
            // @ts-ignore
            window.player = player;
        }, config, clips, audioData, images);

        // Setup FFmpeg
        const fps = config.fps;
        const durationTicks = Math.floor(config.duration * fps);
        const passThrough = new (await import('stream')).PassThrough();

        const ffmpegCommand = ffmpeg(passThrough)
            .inputFPS(fps)
            .inputOptions(['-f image2pipe', '-c:v mjpeg'])
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-preset ultrafast'
            ])
            .on('start', (cmd) => console.log('[Factory] FFmpeg started:', cmd))
            .on('stderr', (data: string) => {
                if (config.debug) console.log('FFmpeg stderr:', data);
            })
            .on('error', (err: any) => {
                console.error('[Factory] FFmpeg error:', err);
            })
            .on('end', () => {
                console.log('[Factory] Rendering finished.');
            })
            .save(outputPath);

        const totalTicks = config.duration * fps;
        console.log(`Starting render: ${totalTicks} frames...`);

        for (let tick = 0; tick < totalTicks; tick++) {
            // Apply dynamic state if onTick is provided
            if (onTick) {
                onTick(tick);
            }

            // Seek and capture
            // We pass the current config as state to sync dynamic changes
            await this.bridge.seekToTick(tick, { camera: config.camera });
            const frame = await this.bridge.captureFrame();
            passThrough.write(frame);

            if (tick % 30 === 0) console.log(`Rendered frame ${tick}/${durationTicks}`);
        }

        passThrough.end();

        // Wait for FFmpeg to finish by listening to the command events
        await new Promise<void>((resolve, reject) => {
            (ffmpegCommand as any).on('end', () => resolve());
            (ffmpegCommand as any).on('error', (err: any) => reject(err));
        });

        // Cleanup
        await this.bridge.close();
        this.server?.close();
    }
}
