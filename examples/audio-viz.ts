import { AudioAnalyzer } from '../src/server/AudioAnalyzer';
import { ClawEngine, BlueprintContext } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

(async () => {
    const analyzer = new AudioAnalyzer();
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
    };

    // 1. Analyze Audio
    console.log('Analyzing audio...');
    const audioPath = path.join(__dirname, '../test.wav');
    const analysis = await analyzer.analyze(audioPath, config.fps, 32);
    console.log('Analysis complete.');

    // 2. Setup Engine
    const engine = new ClawEngine(config);
    engine.setAudioData('main', analysis.frames);

    // 3. Define Clip with Audio-Viz Blueprint
    // NOTE: This blueprint should be registered in the browser bundle too if rendering via Factory
    const clip = {
        id: 'viz-clip',
        blueprintId: 'audio-bars',
        startTick: 0,
        durationTicks: config.duration * config.fps,
        props: { color: '#00ffcc' }
    };

    // 4. Update src/client/index.ts to include 'audio-bars' blueprint
    // (I'll do this in a separate step or just assume it's there for this thought)

    // 5. Render
    const factory = new MotionFactory();
    try {
        await factory.render(config, [clip], path.join(__dirname, '../audio-viz.mp4'), { main: analysis.frames });
        console.log('Render complete: audio-viz.mp4');
    } catch (err) {
        console.error('Render failed:', err);
    }
})();
