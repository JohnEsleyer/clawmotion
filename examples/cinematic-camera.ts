import { ClawEngine, Easing, Clip } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
        camera: { zoom: 1, x: 0, y: 0, shake: 0 }
    };

    const clips: Clip[] = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 150,
            props: { color1: '#121212', color2: '#1f1f1f', color3: '#000000' }
        },
        {
            id: 'grid',
            blueprintId: 'floaty-blobs',
            startTick: 0,
            durationTicks: 150,
            props: { count: 15, color: 'rgba(255,255,255,0.05)' }
        },
        {
            id: 'logo',
            blueprintId: 'text-hero',
            startTick: 45,
            durationTicks: 105,
            entry: { type: 'zoom', durationTicks: 30 },
            props: { text: 'IMPACT', fontSize: 150 }
        },
        {
            id: 'vignette',
            blueprintId: 'vignette',
            startTick: 0,
            durationTicks: 150,
            props: { intensity: 0.8 }
        }
    ];

    const factory = new MotionFactory();

    // onTick allows us to script the camera movement
    const onTick = (tick: number) => {
        const total = config.duration * config.fps;
        const progress = tick / total;

        // 1. Steady Zoom In
        config.camera.zoom = 1.0 + progress * 0.5;

        // 2. Slow Panning
        config.camera.x = Math.sin(progress * Math.PI) * 100;

        // 3. Impact Shake
        // Shake peaks at frame 45 (impact) and decays
        if (tick >= 45 && tick <= 75) {
            const shakeProgress = (tick - 45) / 30; // 0 to 1
            config.camera.shake = (1 - shakeProgress) * 0.8;
        } else {
            config.camera.shake = 0;
        }
    };

    try {
        console.log('Rendering Cinematic Camera Demo...');
        const outputPath = path.join(__dirname, '../cinematic-camera.mp4');
        await factory.render(config, clips, outputPath, undefined, undefined, onTick);
        console.log('Cinematic video saved to:', outputPath);
    } catch (err) {
        console.error('Render failed:', err);
    }
})();
