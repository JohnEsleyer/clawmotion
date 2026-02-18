import * as MP4Muxer from 'mp4-muxer';

export class WebCodecsEncoder {
    private encoder: VideoEncoder;
    private muxer: any;
    private width: number;
    private height: number;
    private fps: number;

    constructor(width: number, height: number, fps: number) {
        this.width = width;
        this.height = height;
        this.fps = fps;

        this.muxer = new MP4Muxer.Muxer({
            target: new MP4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width,
                height
            },
            fastStart: 'in-memory',
        });

        this.encoder = new VideoEncoder({
            output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
            error: (e) => console.error(e),
        });

        this.encoder.configure({
            codec: 'avc1.42001f',
            width,
            height,
            bitrate: 5_000_000,
            framerate: fps,
        });
    }

    public async encodeFrame(bitmap: ImageBitmap, timestampMicroseconds: number) {
        const frame = new VideoFrame(bitmap, { timestamp: timestampMicroseconds });
        const keyFrame = Math.floor(timestampMicroseconds / 1000000 / 2) === 0;
        this.encoder.encode(frame, { keyFrame });
        frame.close();
    }

    public async encodeFrameFromCanvas(canvas: IClawCanvas, tick: number) {
        if (!canvas.transferToImageBitmap) {
            throw new Error('Canvas does not support transferToImageBitmap');
        }
        const bitmap = canvas.transferToImageBitmap();
        const timestampMicroseconds = Math.floor((tick / this.fps) * 1000000);
        await this.encodeFrame(bitmap, timestampMicroseconds);
    }

    public async finalize(): Promise<Blob> {
        await this.encoder.flush();
        this.muxer.finalize();
        const buffer = this.muxer.target.buffer;
        return new Blob([buffer], { type: 'video/mp4' });
    }
}

interface IClawCanvas {
    transferToImageBitmap(): ImageBitmap;
}
