import { ClawPlayer } from './Player';
import { ClawEngine } from '../core/Engine';
import { ClawMath } from '../core/Math';
import { ProBlueprints } from '../blueprints/ProBlueprints';

import { AssetLoader } from './AssetLoader';

// Expose to window for browser access
(window as any).ClawPlayer = ClawPlayer;
(window as any).ClawEngine = ClawEngine;
(window as any).ClawMath = ClawMath;
(window as any).AssetLoader = AssetLoader;

(window as any).PredefinedBlueprints = {
    ...ProBlueprints,
    'rect': (ctx: any) => {
        const { width, height, localTime, utils, props } = ctx;
        const color = props.color || 'red';
        const x = utils.range(0, width - 100) * localTime;
        const y = height / 2 + Math.sin(localTime * Math.PI * 2) * 100;

        ctx.ctx.fillStyle = color;
        ctx.ctx.fillRect(x, y - 50, 100, 100);

        ctx.ctx.fillStyle = 'white';
        ctx.ctx.font = '30px Arial';
        ctx.ctx.fillText(`Frame: ${ctx.tick}`, 50, 50);
    },
    'audio-bars': (ctx: any) => {
        const { width, height, audio, props } = ctx;
        if (!audio) return;

        const bars = audio.frequencies.length;
        const barWidth = (width - 100) / bars;
        const color = props.color || 'cyan';

        ctx.ctx.fillStyle = color;
        for (let i = 0; i < bars; i++) {
            const h = audio.frequencies[i] * 500;
            ctx.ctx.fillRect(50 + i * barWidth, height - 50, barWidth - 2, -h);
        }

        ctx.ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.ctx.fillRect(50, 50, audio.volume * 500, 20);
    }
};

// We also need to update how Factory initializes the engine in the browser to register these.
