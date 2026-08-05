#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { MotionFactory } from '../server/Factory';
import { AudioAnalyzer } from '../server/AudioAnalyzer';
import { ClawConfig, Clip } from '../core/Engine';

const program = new Command();

program
    .name('clawmotion')
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
        console.log(`  clawmotion render ${name}/scene.ts`);
    });

program
    .command('serve')
    .description('Start the ClawMotion render server')
    .action(async () => {
        console.log(`Starting ClawMotion server...`);
        console.log(`Workspace: ${process.cwd()}`);
        console.log(`Server: http://localhost:3001/`);

        const { MotionFactory } = require('../server/Factory');
        const factory = new MotionFactory();
        await factory.serve();
        await factory.keepAlive();
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
            // Load the scene file — Bun loads .ts natively, Node needs ts-node
            let sceneModule: any;
            if (typeof Bun !== 'undefined') {
                sceneModule = await import(absoluteFilePath);
            } else {
                require('ts-node').register({
                    transpileOnly: true,
                    compilerOptions: { module: 'commonjs', target: 'esnext' }
                });
                sceneModule = require(absoluteFilePath);
            }
            const scene = sceneModule.default || sceneModule;

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

            const startTimestamp = Date.now();

            const totalFrames = Math.ceil(config.duration * config.fps);
            let lastPercent = -1;

            console.log(`🚀 Starting render to ${outputPath}...`);

            try {
                await factory.renderNode(config, clips, outputPath);
                
                const duration = ((Date.now() - startTimestamp) / 1000).toFixed(2);
                console.log(`✨ Render complete: ${outputPath} in ${duration}s`);
            } catch(e) {
                throw e;
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
            // Load the scene file — Bun loads .ts natively, Node needs ts-node
            let sceneModule: any;
            if (typeof Bun !== 'undefined') {
                sceneModule = await import(absoluteFilePath);
            } else {
                require('ts-node').register({ transpileOnly: true });
                sceneModule = require(absoluteFilePath);
            }
            const scene = sceneModule.default || sceneModule;
            const factory = new MotionFactory();

            const tempEntryPath = path.join(process.cwd(), '.claw-temp-entry.ts');
            const relativeScenePath = './' + path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, '/').replace(/\.ts$/, '');

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

            await factory.keepAlive();
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

program
    .command('audit')
    .description('Generate keyframe PNG snapshots and JSON report for Vision Models & LLMs')
    .argument('<file>', 'Path to the scene .ts or .js file')
    .option('-o, --outDir <dir>', 'Output directory for snapshots', '.claw-audit')
    .option('-r, --ratios <ratios>', 'Comma-separated frame ratios (e.g. 0.25,0.5,0.75)', '0.25,0.5,0.75')
    .action(async (file, options) => {
        const absoluteFilePath = path.resolve(file);
        if (!fs.existsSync(absoluteFilePath)) {
            console.error(`❌ Error: File not found: ${file}`);
            process.exit(1);
        }

        console.log(`🔍 Auditing scene: ${file}...`);

        try {
            let sceneModule: any;
            if (typeof Bun !== 'undefined') {
                sceneModule = await import(absoluteFilePath);
            } else {
                require('ts-node').register({ transpileOnly: true });
                sceneModule = require(absoluteFilePath);
            }

            const scene = sceneModule.default || sceneModule;
            if (!scene || !scene.config || !scene.clips) {
                console.error(`❌ Error: Invalid scene file format.`);
                process.exit(1);
            }

            const ratios = options.ratios.split(',').map((r: string) => parseFloat(r.trim()));
            const factory = new MotionFactory();

            const report = await factory.snapshotKeyframes(
                scene.config,
                scene.clips,
                file,
                ratios,
                options.outDir,
                scene.blueprints
            );

            console.log(`\n✨ Audit complete! Results saved to: ${path.resolve(options.outDir)}`);
            console.log(`📸 Snapshots generated: ${report.snapshots.length}`);
            report.snapshots.forEach(s => {
                console.log(`  - [${(s.ratio * 100).toFixed(0)}%] Frame ${s.tick} (${s.timeSeconds}s) -> ${s.imagePath}`);
            });
            console.log(`\n📄 Report JSON: ${path.join(path.resolve(options.outDir), 'audit-report.json')}`);
        } catch (err) {
            console.error('❌ Audit failed:');
            console.error(err);
            process.exit(1);
        }
    });

program
    .command('schemas')
    .description('Export JSON schemas of all registered blueprints for AI Agent tool calling')
    .argument('[file]', 'Optional scene file to include scene-specific blueprints')
    .action(async (file) => {
        const { BlueprintRegistry } = require('../core/Blueprint');
        const { ProBlueprints } = require('../blueprints/ProBlueprints');

        const registry = new BlueprintRegistry();
        Object.entries(ProBlueprints).forEach(([id, bp]) => registry.register(id, bp as any));

        if (file) {
            const absoluteFilePath = path.resolve(file);
            let sceneModule: any;
            if (typeof Bun !== 'undefined') {
                sceneModule = await import(absoluteFilePath);
            } else {
                require('ts-node').register({ transpileOnly: true });
                sceneModule = require(absoluteFilePath);
            }
            const scene = sceneModule.default || sceneModule;
            if (scene?.blueprints) {
                Object.entries(scene.blueprints).forEach(([id, bp]) => registry.register(id, bp as any));
            }
        }

        console.log(JSON.stringify(registry.exportSchemas(), null, 2));
    });

program.parse();
