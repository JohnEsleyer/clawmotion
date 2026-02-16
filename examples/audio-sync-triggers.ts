import { ClawEngine, AudioTrigger, Clip } from '../src/core';
import { MotionFactory, AudioAnalyzer } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
    };

    // 1. Audio Setup
    const analyzer = new AudioAnalyzer();
    const audioPath = path.join(__dirname, '../test.wav');
    console.log('Analyzing audio for triggers...');
    const analysis = await analyzer.analyze(audioPath, config.fps, 16);

    // 2. Automated Triggers
    console.log('Generating automated triggers...');

    // a. Camera Shake on Bass/Volume
    const shakeKeyframes = AudioTrigger.generateKeyframes(analysis.frames, {
        type: 'volume',
        threshold: 0.5,
        cooldownTicks: 15, // Max 2 per second at 30fps
        reaction: {
            durationTicks: 10,
            peakValue: 1.0,
            baseValue: 0
        }
    });

    // b. Logo Pulse on Volume
    const scaleKeyframes = AudioTrigger.generateKeyframes(analysis.frames, {
        type: 'volume',
        threshold: 0.5,
        cooldownTicks: 10,
        reaction: {
            durationTicks: 8,
            peakValue: 1.5,
            baseValue: 1.0,
            easing: 'easeOutExpo'
        }
    });

    // 3. Setup Engine
    const engine = new ClawEngine(config);
    engine.setAudioData('main', analysis.frames);
    engine.cameraAnimations.shake = shakeKeyframes;

    const clips: Clip[] = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 150,
            props: { color1: '#000000', color2: '#1a1a2e', color3: '#1a1a2e' }
        },
        {
            id: 'pulse-text',
            blueprintId: 'text-hero',
            startTick: 0,
            durationTicks: 150,
            animations: {
                fontSize: scaleKeyframes.map(kf => ({ ...kf, value: kf.value * 100 }))
            },
            props: { text: 'REACTIVE', fontSize: 100 }
        }
    ];

    const factory = new MotionFactory();
    try {
        const outputPath = path.join(__dirname, '../audio-triggers.mp4');
        await factory.render(config, clips, outputPath, { main: analysis.frames });
        console.log('Render complete: audio-triggers.mp4');
    } catch (err) {
        console.error('Render failed:', err);
    }
})();
