import { spawn, ChildProcess } from 'child_process';

export class NodeEncoder {
    private ffmpeg: ChildProcess;
    private width: number;
    private height: number;
    private fps: number;

    constructor(width: number, height: number, fps: number, outputPath: string) {
        this.width = width;
        this.height = height;
        this.fps = fps;

        this.ffmpeg = spawn('ffmpeg', [
            '-y',
            '-f', 'rawvideo',
            '-pix_fmt', 'rgba',
            '-s', `${width}x${height}`,
            '-r', `${fps}`,
            '-i', '-',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-loglevel', 'error',
            outputPath
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.ffmpeg.stderr?.on('data', (data) => {
            console.error(`FFmpeg: ${data}`);
        });
        
        this.ffmpeg.on('error', (err) => {
            console.error('FFmpeg error:', err);
        });
    }

    public writeFrame(buffer: Buffer) {
        if (this.ffmpeg.stdin && !this.ffmpeg.stdin.destroyed) {
            this.ffmpeg.stdin.write(buffer);
        }
    }

    public async writeFrameFromCanvas(canvas: any) {
        const buffer = await canvas.toBuffer('raw');
        this.writeFrame(buffer);
    }

    public close(): Promise<void> {
        return new Promise((resolve) => {
            if (this.ffmpeg.stdin) {
                this.ffmpeg.stdin.end();
            }
            this.ffmpeg.on('close', () => resolve());
        });
    }
}
