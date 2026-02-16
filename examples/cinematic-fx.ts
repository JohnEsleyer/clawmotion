import { ClawEngine, Clip } from '../src/core';
import { MotionFactory, AudioAnalyzer } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
        effects: {
            chromatic: 0,
            vignette: 0.5
        }
    };

    // 1. Audio Setup
    const analyzer = new AudioAnalyzer();
    const audioPath = path.join(__dirname, '../test.wav');
    const analysis = await analyzer.analyze(audioPath, config.fps, 16);

    const clips: Clip[] = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 150,
            props: { color1: '#000c1d', color2: '#002f5e', color3: '#000000' }
        },
        {
            id: 'text',
            blueprintId: 'text-hero',
            startTick: 0,
            durationTicks: 150,
            props: { text: 'POST PROCESS', fontSize: 120 }
        },
        {
            id: 'viz',
            blueprintId: 'audio-bars',
            startTick: 0,
            durationTicks: 150,
            props: { color: 'rgba(0, 255, 255, 0.3)' }
        }
    ];

    const factory = new MotionFactory();

    // onTick to drive effects from audio volume
    const onTick = (tick: number) => {
        const frame = analysis.frames[tick];
        if (!frame) return;

        // Drive chromatic aberration from volume
        config.effects.chromatic = frame.volume * 5.0;

        // Drive vignette intensity from volume
        config.effects.vignette = 0.4 + frame.volume * 0.6;
    };

    try {
        console.log('Rendering Cinematic FX Showcase...');
        const outputPath = path.join(__dirname, '../cinematic-fx.mp4');
        await factory.render(config, clips, outputPath, { main: analysis.frames }, undefined, onTick);
        console.log('Cinematic FX saved to:', outputPath);
    } catch (err) {
        console.error('Render failed:', err);
    }
})();
