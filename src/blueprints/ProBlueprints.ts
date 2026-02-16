import { BlueprintContext } from '../core/Context';

export const ProBlueprints = {
    'gradient-bg': (ctx: BlueprintContext) => {
        const { width, height, localTime, props } = ctx;
        const c1 = props.color1 || '#0f0c29';
        const c2 = props.color2 || '#302b63';
        const c3 = props.color3 || '#24243e';

        const grad = ctx.ctx.createLinearGradient(
            0, 0,
            width * Math.cos(localTime * Math.PI),
            height * Math.sin(localTime * Math.PI)
        );
        grad.addColorStop(0, c1);
        grad.addColorStop(0.5, c2);
        grad.addColorStop(1, c3);

        ctx.ctx.fillStyle = grad;
        ctx.ctx.fillRect(0, 0, width, height);
    },

    'text-hero': (ctx: BlueprintContext) => {
        const { width, height, localTime, props, utils } = ctx;
        const text = props.text || 'CLAW MOTION';
        const fontSize = props.fontSize || 80;

        // Easing in
        const opacity = Math.min(1, localTime * 2);
        const yOffset = (1 - localTime) * 50;

        ctx.ctx.save();
        ctx.ctx.globalAlpha = opacity;
        ctx.ctx.fillStyle = 'white';
        ctx.ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
        ctx.ctx.textAlign = 'center';
        ctx.ctx.textBaseline = 'middle';

        // Text Shadow for premium feel
        ctx.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.ctx.shadowBlur = 20;
        ctx.ctx.shadowOffsetX = 5;
        ctx.ctx.shadowOffsetY = 5;

        ctx.ctx.fillText(text, width / 2, height / 2 + yOffset);
        ctx.ctx.restore();
    },

    'floaty-blobs': (ctx: BlueprintContext) => {
        const { width, height, localTime, utils, props } = ctx;
        const count = props.count || 5;
        const seed = props.seed || 42;

        const rng = utils; // Already seeded in Context

        ctx.ctx.save();
        for (let i = 0; i < count; i++) {
            // Use i to offset the deterministic math
            const x = (width * 0.1) + (width * 0.8) * ((Math.sin(localTime + i * 1.5) + 1) / 2);
            const y = (height * 0.1) + (height * 0.8) * ((Math.cos(localTime * 0.7 + i * 2.2) + 1) / 2);
            const size = 100 + Math.sin(localTime * 2 + i) * 50;

            const grad = ctx.ctx.createRadialGradient(x, y, 0, x, y, size);
            grad.addColorStop(0, props.color || 'rgba(0, 255, 255, 0.4)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

            ctx.ctx.fillStyle = grad;
            ctx.ctx.beginPath();
            ctx.ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.ctx.fill();
        }
        ctx.ctx.restore();
    },

    'image': (ctx: BlueprintContext) => {
        const { width, height, localTime, props, getAsset } = ctx;
        const assetId = props.assetId;
        const img = getAsset(assetId);

        if (!img) return;

        const x = props.x || 0;
        const y = props.y || 0;
        const w = props.width || img.width;
        const h = props.height || img.height;

        // Optional animation
        const scale = props.animateScale ? 0.8 + 0.2 * Math.sin(localTime * Math.PI) : 1.0;

        ctx.ctx.save();
        ctx.ctx.translate(x + w / 2, y + h / 2);
        ctx.ctx.scale(scale, scale);
        ctx.ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.ctx.restore();
    },

    'glass-card': (ctx: BlueprintContext) => {
        const { width, height, localTime, props } = ctx;
        const x = props.x || 100;
        const y = props.y || 100;
        const w = props.w || 300;
        const h = props.h || 200;
        const radius = props.radius || 20;

        // Entry animation
        const slide = (1 - localTime) * 100;
        const opacity = Math.min(1, localTime * 2);

        ctx.ctx.save();
        ctx.ctx.globalAlpha = opacity;
        ctx.ctx.translate(0, slide);

        // Shadow
        ctx.ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.ctx.shadowBlur = 30;
        ctx.ctx.shadowOffsetY = 10;

        // Glass Body
        ctx.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.ctx.lineWidth = 2;

        const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            ctx.ctx.beginPath();
            ctx.ctx.moveTo(x + r, y);
            ctx.ctx.lineTo(x + w - r, y);
            ctx.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.ctx.lineTo(x + w, y + h - r);
            ctx.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.ctx.lineTo(x + r, y + h);
            ctx.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.ctx.lineTo(x, y + r);
            ctx.ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.ctx.closePath();
        };

        drawRoundedRect(x, y, w, h, radius);
        ctx.ctx.fill();
        ctx.ctx.stroke();

        // Label
        ctx.ctx.shadowBlur = 0; // Disable shadow for text
        ctx.ctx.fillStyle = 'white';
        ctx.ctx.font = 'bold 24px Arial';
        ctx.ctx.fillText(props.title || 'Product Info', x + 20, y + 40);

        ctx.ctx.font = '18px Arial';
        ctx.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.ctx.fillText(props.subtitle || 'Premium Quality', x + 20, y + 70);

        ctx.ctx.restore();
    },

    'vignette': (ctx: BlueprintContext) => {
        const { width, height, props } = ctx;
        const color = props.color || 'black';
        const intensity = props.intensity ?? 0.5;

        const grad = ctx.ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.sqrt(width ** 2 + height ** 2) / 1.5
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, color);

        ctx.ctx.save();
        ctx.ctx.globalAlpha = intensity;
        ctx.ctx.fillStyle = grad;
        ctx.ctx.fillRect(0, 0, width, height);
        ctx.ctx.restore();
    }
};
