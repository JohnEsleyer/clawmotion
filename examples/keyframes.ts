import { ClawEngine, Clip } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
    };

    const clips: Clip[] = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 150,
            animations: {
                color1: [
                    { tick: 0, value: '#000000' },
                    { tick: 75, value: '#ff0055', easing: 'easeInOutQuad' },
                    { tick: 150, value: '#000000', easing: 'easeInOutQuad' }
                ]
            }
        },
        {
            id: 'hero',
            blueprintId: 'text-hero',
            startTick: 30,
            durationTicks: 90,
            animations: {
                fontSize: [
                    { tick: 0, value: 50 },
                    { tick: 45, value: 200, easing: 'easeOutQuad' },
                    { tick: 90, value: 120, easing: 'easeInOutQuad' }
                ],
                text: [
                    { tick: 0, value: 'ANIMATE' },
                    { tick: 45, value: 'EVERYTHING' },
                ]
            }
        }
    ];

    const factory = new MotionFactory();

    try {
        console.log('Rendering Keyframes Showcase...');
        const outputPath = path.join(__dirname, '../keyframes.mp4');
        await factory.render(config, clips, outputPath);
        console.log('Keyframes video saved to:', outputPath);
    } catch (err) {
        console.error('Render failed:', err);
    }
})();
