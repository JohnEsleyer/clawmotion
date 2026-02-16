import { ClawEngine, Clip } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 8,
    };

    const clips: Clip[] = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 240,
            props: { color1: '#1a2a6c', color2: '#b21f1f', color3: '#fdbb2d' }
        },
        {
            id: 'title-1',
            blueprintId: 'text-hero',
            startTick: 15,
            durationTicks: 60,
            entry: { type: 'slide', durationTicks: 20 },
            exit: { type: 'fade', durationTicks: 20 },
            props: { text: 'DECLARATIVE', fontSize: 100 }
        },
        {
            id: 'title-2',
            blueprintId: 'text-hero',
            startTick: 90,
            durationTicks: 60,
            entry: { type: 'zoom', durationTicks: 20 },
            exit: { type: 'slide', durationTicks: 20 },
            props: { text: 'POWERFUL', fontSize: 100 }
        },
        {
            id: 'title-3',
            blueprintId: 'text-hero',
            startTick: 165,
            durationTicks: 60,
            entry: { type: 'fade', durationTicks: 20 },
            exit: { type: 'zoom', durationTicks: 20 },
            props: { text: 'CLAW MOTION', fontSize: 100 }
        }
    ];

    const factory = new MotionFactory();

    try {
        console.log('Rendering Transitions Showcase...');
        const outputPath = path.join(__dirname, '../transitions.mp4');
        await factory.render(config, clips, outputPath);
        console.log('Transitions saved to:', outputPath);
    } catch (err) {
        console.error('Transitions render failed:', err);
    }
})();
