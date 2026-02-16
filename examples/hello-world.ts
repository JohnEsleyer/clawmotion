import { ClawEngine, BlueprintContext } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

// Define a simple Blueprint
const RectBlueprint = (ctx: BlueprintContext) => {
    const { width, height, localTime, utils, props } = ctx;
    const color = props.color || 'red';

    // Animate x position from 0 to width - 100
    const x = utils.range(0, width - 100) * localTime; // Simple linear movement

    // Use easing
    const y = height / 2 + Math.sin(localTime * Math.PI * 2) * 100;

    ctx.ctx.fillStyle = color;
    ctx.ctx.fillRect(x, y - 50, 100, 100);

    ctx.ctx.fillStyle = 'white';
    ctx.ctx.font = '30px Arial';
    ctx.ctx.fillText(`Frame: ${ctx.tick}`, 50, 50);
};

(async () => {
    // 1. Setup Engine
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5, // seconds
    };

    const engine = new ClawEngine(config);

    // 2. Register Blueprints
    // Note: For the server-side render to work with this blueprint, 
    // the Client Bundle must ALSO have this blueprint registered.
    // This example script runs in Node.js. 
    // The Client (Browser) doesn't know about 'RectBlueprint' unless we include it in the bundle entry.
    //
    // CRITICAL: In a real app, blueprints should be shared code imported by both client and server (or just client).
    // For this test, we need to inject this blueprint into the client.
    // 
    // To fix this for the example:
    // The 'MotionFactory' bundles 'src/client/index.ts'.
    // We need to add this blueprint to 'src/client/index.ts' or make 'src/client/index.ts' load a registry.
    //
    // Let's modify valid usage:
    // The User writes blueprints in a file, say 'src/blueprints/MyBlueprints.ts'.
    // Then imports them in 'src/client/index.ts'.
    // 
    // For this simple test, I will modify 'src/client/index.ts' to include a test blueprint.

    console.log('Skipping blueprint registration in Node, focusing on Factory execution...');

    // 3. Define Clip
    const clip = {
        id: 'test-clip',
        blueprintId: 'rect', // We will add 'rect' to the client registry
        startTick: 0,
        durationTicks: config.duration * config.fps,
        props: { color: 'cyan' }
    };

    // 4. Render
    const factory = new MotionFactory();
    console.log('Starting render...');

    try {
        const outputPath = path.join(__dirname, '../output.mp4');
        await factory.render(config, [clip], outputPath);
        console.log('Render complete:', outputPath);
    } catch (err) {
        console.error('Render failed:', err);
    }
})();
