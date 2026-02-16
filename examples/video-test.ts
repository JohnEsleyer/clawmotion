import { ClawEngine } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 3, // 3 seconds
        concurrency: 1 // Keep it simple for debug
    };

    const engine = new ClawEngine(config);

    const videoClip = {
        id: 'bg-video',
        blueprintId: 'video',
        startTick: 0,
        durationTicks: config.duration * config.fps,
        props: {
            assetId: 'background-mp4',
            width: 1280,
            height: 720
        }
    };

    const textClip = {
        id: 'overlay-text',
        blueprintId: 'text-hero',
        startTick: 15, // Start after 0.5s
        durationTicks: config.duration * config.fps - 15,
        props: {
            text: 'DETERMINISTIC VIDEO',
            fontSize: 60
        },
        blendMode: 'overlay' as any
    };

    const factory = new MotionFactory();
    console.log('Starting video render test...');

    try {
        const outputPath = path.join(__dirname, '../video-output.mp4');
        const videoInputPath = path.join(__dirname, '../cinematic-camera.mp4');

        // We need to provide the image map (which works for videos too since AssetLoader is used)
        await factory.render(config, [videoClip, textClip], outputPath, null, {
            'background-mp4': '/assets/cinematic-camera.mp4'
        });

        console.log('Video render complete:', outputPath);
    } catch (err) {
        console.error('Video render failed:', err);
    }
})();
