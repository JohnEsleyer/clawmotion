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
    public async serve(clientEntry?: string) {
        // 1. Bundle Client Code
        const bundlePath = path.join(__dirname, '../../dist/bundle.js');
        const clientEntryTs = path.join(__dirname, '../client/index.ts');
        const clientEntryJs = path.join(__dirname, '../client/index.js');

        const entryPoint = clientEntry || (fs.existsSync(clientEntryTs) ? clientEntryTs : clientEntryJs);

        console.log(`[Factory] Bundling client code from ${entryPoint}...`);
        try {
            if (!fs.existsSync(entryPoint)) {
                throw new Error(`Client entry point not found at ${entryPoint}`);
            }

            await esbuild.build({
                entryPoints: [entryPoint],
                bundle: true,
                outfile: bundlePath,
                platform: 'browser',
                format: 'iife',
                logLevel: 'error'
            });
            console.log('[Factory] Bundling complete.');
        } catch (e) {
            console.error('[Factory] Bundling failed:', e);
            throw e;
        }

        // 2. Start Express
        console.log('[Factory] Starting Express server...');
        const app = express();
        const distPath = path.join(__dirname, '../../dist');
        app.use(express.static(distPath));
        app.use('/assets', express.static(process.cwd()));

        app.get('/', (req, res) => {
            const htmlPath = path.join(__dirname, './preview.html');
            if (fs.existsSync(htmlPath)) {
                res.sendFile(htmlPath);
            } else {
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
     * Render the video to a file, supporting parallel chunks.
     */
    public async render(config: ClawConfig, clips: Clip[], outputPath: string, audioData?: any, images?: Record<string, string>, clientEntry?: string, onTick?: (tick: number) => void) {
        await this.serve(clientEntry);

        const concurrency = config.concurrency || 1;
        const totalTicks = config.duration * config.fps;
        const chunkSize = Math.ceil(totalTicks / concurrency);
        const tempDir = path.join(process.cwd(), '.claw-temp');

        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const chunkFiles: string[] = [];
        const workers: Promise<void>[] = [];

        console.log(`[Factory] Starting parallel render with ${concurrency} workers...`);

        for (let i = 0; i < concurrency; i++) {
            const startTick = i * chunkSize;
            const endTick = Math.min((i + 1) * chunkSize, totalTicks);

            if (startTick >= totalTicks) break;

            const chunkId = `chunk-${i}`;
            const chunkPath = path.join(tempDir, `${chunkId}.mp4`);
            chunkFiles.push(chunkPath);

            workers.push(this.renderChunk(config, clips, chunkPath, startTick, endTick, audioData, images, onTick));
        }

        try {
            await Promise.all(workers);
            console.log('[Factory] All chunks rendered. Stitching...');

            await this.stitchChunks(chunkFiles, outputPath, config.debug);
            console.log('[Factory] Stitching complete.');
        } finally {
            // Cleanup chunks
            chunkFiles.forEach(f => {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            });
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                if (files.length === 0) fs.rmdirSync(tempDir);
            }
            this.server?.close();
        }
    }

    private async renderChunk(config: ClawConfig, clips: Clip[], chunkPath: string, startTick: number, endTick: number, audioData?: any, images?: Record<string, string>, onTick?: (tick: number) => void) {
        const bridge = new PuppeteerBridge();
        await bridge.launch(`http://127.0.0.1:${this.port}`, config.width, config.height);

        const page = (bridge as any).page;
        await page.evaluate(async (conf: any, clipList: any, audio: any, imageMap: any, camAnims: any) => {
            // @ts-ignore
            if (!window.ClawEngine) throw new Error("ClawEngine not found on window");
            // @ts-ignore
            const engine = new window.ClawEngine(conf);
            // @ts-ignore
            const loader = new window.AssetLoader();

            if (imageMap) {
                for (const [id, url] of Object.entries(imageMap)) {
                    const assetUrl = url as string;
                    const resolvedAssetUrl = (
                        assetUrl.startsWith('http://') ||
                        assetUrl.startsWith('https://') ||
                        assetUrl.startsWith('data:') ||
                        assetUrl.startsWith('blob:') ||
                        assetUrl.startsWith('/assets/')
                    )
                        ? assetUrl
                        : `/assets/${assetUrl.replace(/^\.?\//, '')}`;
                    if (assetUrl.endsWith('.mp4') || assetUrl.endsWith('.webm')) {
                        const video = await loader.loadVideo(resolvedAssetUrl);
                        engine.assets.set(id, video);
                    } else {
                        const img = await loader.loadImage(resolvedAssetUrl);
                        engine.assets.set(id, img);
                    }
                }
            }

            if (audio) {
                Object.entries(audio).forEach(([id, frames]) => {
                    engine.setAudioData(id, frames as any[]);
                });
            }

            // @ts-ignore
            if (window.PredefinedBlueprints) {
                // @ts-ignore
                Object.entries(window.PredefinedBlueprints).forEach(([id, bp]) => {
                    engine.registry.register(id, bp);
                });
            }

            clipList.forEach((c: any) => engine.addClip(c));
            if (camAnims) engine.cameraAnimations = camAnims;

            // @ts-ignore
            const player = new window.ClawPlayer('#preview', engine);
            // @ts-ignore
            window.player = player;
        }, config, clips, audioData, images, (config as any).cameraAnimations);

        // Setup FFmpeg for this chunk
        const passThrough = new (await import('stream')).PassThrough();
        const ffmpegCommand = ffmpeg(passThrough)
            .inputFPS(config.fps)
            .inputOptions(['-f image2pipe', '-c:v mjpeg'])
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-preset ultrafast',
                '-crf 18' // High quality for intermediate chunks
            ])
            .save(chunkPath);

        for (let tick = startTick; tick < endTick; tick++) {
            await bridge.seekToTick(tick, {
                camera: config.camera,
                effects: config.effects
            });
            const frame = await bridge.captureFrame();
            passThrough.write(frame);
            if (onTick) onTick(tick);
        }

        passThrough.end();

        await new Promise<void>((resolve, reject) => {
            (ffmpegCommand as any).on('end', () => resolve());
            (ffmpegCommand as any).on('error', (err: any) => reject(err));
        });

        await bridge.close();
    }

    private async stitchChunks(chunkFiles: string[], outputPath: string, debug?: boolean) {
        return new Promise<void>((resolve, reject) => {
            const command = ffmpeg();

            // Create a temporary file list for FFmpeg concat demuxer
            const listPath = path.join(process.cwd(), '.claw-temp', 'list.txt');
            const listContent = chunkFiles.map(f => `file '${path.resolve(f)}'`).join('\n');
            fs.writeFileSync(listPath, listContent);

            ffmpeg()
                .input(listPath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions(['-c copy']) // Use stream copy for speed and no generational loss
                .on('start', (cmd) => debug && console.log('[Factory] FFmpeg Concatenate:', cmd))
                .on('error', (err) => {
                    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
                    reject(err);
                })
                .on('end', () => {
                    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
                    resolve();
                })
                .save(outputPath);
        });
    }
}
