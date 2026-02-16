import { ClawEngine } from '../src/core';
import { MotionFactory } from '../src/server';
import path from 'path';

(async () => {
    const config = {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
    };

    const clips = [
        {
            id: 'bg',
            blueprintId: 'gradient-bg',
            startTick: 0,
            durationTicks: 150,
            props: { color1: '#000000', color2: '#1a1a2e', color3: '#16213e' }
        },
        {
            id: 'blobs',
            blueprintId: 'floaty-blobs',
            startTick: 0,
            durationTicks: 150,
            props: { count: 8, color: 'rgba(0, 120, 255, 0.2)' }
        },
        {
            id: 'product',
            blueprintId: 'image',
            startTick: 15, // Delay product entry
            durationTicks: 135,
            props: {
                assetId: 'hero-product',
                x: 1280 / 2 - 250,
                y: 720 / 2 - 250,
                width: 500,
                height: 500,
                animateScale: true
            }
        },
        {
            id: 'text',
            blueprintId: 'text-hero',
            startTick: 30,
            durationTicks: 120,
            props: { text: 'NEXT GEN CLAW', fontSize: 100 }
        }
    ];

    const factory = new MotionFactory();

    // Using a high-quality product placeholder
    const images = {
        'hero-product': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=500&h=500'
    };

    try {
        console.log('Starting Pro Promo render...');
        await factory.render(config, clips, path.join(__dirname, '../pro-promo.mp4'), null, images);
        console.log('Render complete: pro-promo.mp4');
    } catch (err) {
        console.error('Pro Promo Render failed:', err);
    }
})();
