#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { MotionFactory } from '../server/Factory';
import { AudioAnalyzer } from '../server/AudioAnalyzer';
import { ClawConfig, Clip } from '../core/Engine';

const program = new Command();

program
    .name('claw')
    .description('ClawMotion CLI for programmatic video movement')
    .version('0.1.0');

program
    .command('init')
    .description('Initialize a new ClawMotion project or scene')
    .argument('[name]', 'Name of the scene/project', 'my-scene')
    .action(async (name) => {
        console.log(`🚀 Initializing ClawMotion scene: ${name}...`);

        const sceneDir = path.join(process.cwd(), name);
        if (!fs.existsSync(sceneDir)) {
            fs.mkdirSync(sceneDir, { recursive: true });
        }

        const sceneFile = path.join(sceneDir, 'scene.ts');
        const blueprintDir = path.join(sceneDir, 'blueprints');

        if (!fs.existsSync(blueprintDir)) {
            fs.mkdirSync(blueprintDir);
        }

        // Create a sample blueprint
        const sampleBlueprint = `import { BlueprintContext } from '@johnesleyer/clawmotion';

export const RectBlueprint = (ctx: BlueprintContext) => {
    const { width, height, localTime, props } = ctx;
    const color = props.color || 'red';
    const x = (width - 100) * localTime;
    const y = height / 2 - 50;

    ctx.ctx.fillStyle = color;
    ctx.ctx.fillRect(x, y, 100, 100);
};
`;
        fs.writeFileSync(path.join(blueprintDir, 'RectBlueprint.ts'), sampleBlueprint);

        // Create a sample scene
        const sampleScene = `import { RectBlueprint } from './blueprints/RectBlueprint';

export default {
    config: {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
        concurrency: 4
    },
    blueprints: {
        'rect': RectBlueprint
    },
    clips: [
        {
            id: 'box-1',
            blueprintId: 'rect',
            startTick: 0,
            durationTicks: 150, // 5 seconds * 30 fps
            props: { color: 'cyan' }
        }
    ]
};
`;
        fs.writeFileSync(sceneFile, sampleScene);

        console.log(`✅ Scene created at ${sceneFile}`);
        console.log(`\nTo render:`);
        console.log(`  claw render ${name}/scene.ts`);
    });

program
    .command('render')
    .description('Render a ClawMotion scene file')
    .argument('<file>', 'Path to the scene .ts or .js file')
    .option('-o, --output <path>', 'Output video path', 'output.mp4')
    .option('-p, --parallel <n>', 'Number of parallel workers', '4')
    .action(async (file, options) => {
        const absoluteFilePath = path.resolve(file);
        if (!fs.existsSync(absoluteFilePath)) {
            console.error(`❌ Error: File not found: ${file}`);
            process.exit(1);
        }

        console.log(`🎬 Loading scene: ${file}...`);

        try {
            // Use ts-node to register and load the TS file
            require('ts-node').register({
                transpileOnly: true,
                compilerOptions: {
                    module: 'commonjs',
                    target: 'esnext'
                }
            });

            const sceneModule = require(absoluteFilePath);
            const scene = sceneModule.default;

            if (!scene || !scene.config || !scene.clips) {
                console.log('ℹ️ No scene definition found (export default { config, clips, ... }).');
                console.log('ℹ️ Assuming this is a standalone script and letting it run...');
                return;
            }

            const config: ClawConfig = {
                ...scene.config,
                concurrency: parseInt(options.parallel) || scene.config.concurrency || 1
            };

            const clips: Clip[] = scene.clips;
            const outputPath = path.resolve(options.output);

            // Handle Assets (Audio/Images)
            let audioData: any = {};
            if (scene.audio) {
                const analyzer = new AudioAnalyzer();
                for (const [id, audioPath] of Object.entries(scene.audio)) {
                    const absoluteAudioPath = path.resolve(path.dirname(absoluteFilePath), audioPath as string);
                    console.log(`🎵 Analyzing audio track '${id}': ${audioPath}...`);
                    const analysis = await analyzer.analyze(absoluteAudioPath, config.fps, 32);
                    audioData[id] = analysis.frames;
                }
            }

            // Inject blueprints into Factory for the client bundle
            // This is the tricky part. Factory currently uses src/client/index.ts.
            // We need it to include the project's blueprints.

            const factory = new MotionFactory();

            // Generate a temporary entry point for the browser to include the scene's blueprints
            const tempEntryPath = path.join(process.cwd(), '.claw-temp-entry.ts');
            const relativeScenePath = './' + path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, '/').replace(/\.ts$/, '');

            // Determine if we should import from local src or the package
            // NOTE: In production, this would be '@johnesleyer/clawmotion'
            const srcPath = path.join(process.cwd(), 'src');
            const isDev = fs.existsSync(srcPath);
            const corePath = isDev ? './src' : '@johnesleyer/clawmotion';

            const entryContent = `
import { ClawPlayer } from '${corePath}/client/Player';
import { AssetLoader } from '${corePath}/client/AssetLoader';
import { ClawEngine } from '${corePath}/core/Engine';
import { ClawMath } from '${corePath}/core/Math';
import scene from '${relativeScenePath}';

(window as any).ClawPlayer = ClawPlayer;
(window as any).ClawEngine = ClawEngine;
(window as any).ClawMath = ClawMath;
(window as any).AssetLoader = AssetLoader;
(window as any).PredefinedBlueprints = scene.blueprints || {};
`;
            fs.writeFileSync(tempEntryPath, entryContent);

            console.log(`🚀 Starting render to ${outputPath}...`);
            try {
                await factory.render(config, clips, outputPath, audioData, scene.images, tempEntryPath);
                console.log(`✨ Render complete: ${outputPath}`);
            } finally {
                if (fs.existsSync(tempEntryPath)) fs.unlinkSync(tempEntryPath);
            }
        } catch (err) {
            console.error('❌ Render failed:');
            console.error(err);
            process.exit(1);
        }
    });

program
    .command('preview')
    .description('Start a preview server for a scene')
    .argument('<file>', 'Path to the scene .ts or .js file')
    .action(async (file) => {
        const absoluteFilePath = path.resolve(file);
        if (!fs.existsSync(absoluteFilePath)) {
            console.error(`❌ Error: File not found: ${file}`);
            process.exit(1);
        }

        console.log(`👁️ Previewing scene: ${file}...`);

        try {
            require('ts-node').register({ transpileOnly: true });
            const factory = new MotionFactory();

            const tempEntryPath = path.join(process.cwd(), '.claw-temp-entry.ts');
            const relativeScenePath = './' + path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, '/').replace(/\.ts$/, '');

            const srcPath = path.join(process.cwd(), 'src');
            const isDev = fs.existsSync(srcPath);
            const corePath = isDev ? './src' : '@johnesleyer/clawmotion';

            // Load scene primarily to get the config
            const sceneModule = require(absoluteFilePath);
            const scene = sceneModule.default || sceneModule;

            const entryContent = `
import { ClawPlayer } from '${corePath}/client/Player';
import { AssetLoader } from '${corePath}/client/AssetLoader';
import { ClawEngine } from '${corePath}/core/Engine';
import { ClawMath } from '${corePath}/core/Math';
import scene from '${relativeScenePath}';

(window as any).ClawPlayer = ClawPlayer;
(window as any).ClawEngine = ClawEngine;
(window as any).ClawMath = ClawMath;
(window as any).AssetLoader = AssetLoader;
(window as any).PredefinedBlueprints = scene.blueprints || {};

window.onload = () => {
    const engine = new (window as any).ClawEngine(scene.config);
    // Add clips
    scene.clips.forEach(c => engine.addClip(c));
    if (scene.cameraAnimations) engine.cameraAnimations = scene.cameraAnimations;
    
    // Handle Assets
    const loader = new (window as any).AssetLoader();
    const assetPromises = [];
    if (scene.images) {
        for (const [id, url] of Object.entries(scene.images)) {
             const assetUrl = '/assets/' + url;
             if (url.endsWith('.mp4') || url.endsWith('.webm')) {
                 assetPromises.push(loader.loadVideo(assetUrl).then(v => engine.assets.set(id, v)));
             } else {
                 assetPromises.push(loader.loadImage(assetUrl).then(img => engine.assets.set(id, img)));
             }
        }
    }

    Promise.all(assetPromises).then(() => {
        const player = new (window as any).ClawPlayer('#preview', engine);
        player.play();
        console.log("Preview Ready");
    });
};
`;
            fs.writeFileSync(tempEntryPath, entryContent);

            await factory.serve(tempEntryPath);
            console.log(`\n🚀 Preview server running at http://localhost:3001`);
            console.log(`Press Ctrl+C to stop`);

            // Keep process alive
        } catch (err) {
            console.error('❌ Preview failed:');
            console.error(err);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List built-in blueprints')
    .action(async () => {
        const { ProBlueprints } = require('../blueprints/ProBlueprints');
        console.log('💎 Built-in Pro Blueprints:');
        Object.keys(ProBlueprints).forEach(id => {
            console.log(`  - ${id}`);
        });
    });

program.parse();
