import { ClawEngine } from '../src/core';
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
    const audioAnalysis = await analyzer.analyze(audioPath, config.fps, 32);

    // 2. Scene Definition (Agent-style Manifest)
    const clips = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 150,
            props: { color1: '#0f0c29', color2: '#302b63', color3: '#24243e' }
        },
        {
            id: 'particles',
            blueprintId: 'floaty-blobs',
            startTick: 0,
            durationTicks: 150,
            props: { count: 12, color: 'rgba(255, 0, 150, 0.15)' }
        },
        {
            id: 'viz',
            blueprintId: 'audio-bars',
            startTick: 0,
            durationTicks: 150,
            layer: 10,
            props: { color: 'rgba(255,255,255,0.1)' }
        },
        {
            id: 'product',
            blueprintId: 'image',
            startTick: 0,
            durationTicks: 150,
            layer: 20,
            props: {
                assetId: 'device',
                x: 1280 - 600,
                y: 100,
                width: 500,
                height: 500,
                animateScale: true
            }
        },
        {
            id: 'card',
            blueprintId: 'glass-card',
            startTick: 20,
            durationTicks: 130,
            layer: 30,
            props: {
                x: 100, y: 350, w: 450, h: 250,
                title: 'CLAW ENGINE 2.0',
                subtitle: 'Professional Motion for Agents'
            }
        },
        {
            id: 'title',
            blueprintId: 'text-hero',
            startTick: 10,
            durationTicks: 50,
            layer: 40,
            props: { text: 'UNLEASH THE CLAW', fontSize: 120 }
        }
    ];

    const images = {
        'device': 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?auto=format&fit=crop&q=80&w=500&h=500'
    };

    const factory = new MotionFactory();

    try {
        console.log('Rendering Full Showcase...');
        const outputPath = path.join(__dirname, '../showcase.mp4');
        await factory.render(config, clips, outputPath, { main: audioAnalysis.frames }, images);
        console.log('Showcase saved to:', outputPath);
    } catch (err) {
        console.error('Showcase render failed:', err);
    }
})();
