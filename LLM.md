# 🦀 ClawMotion | LLM Context & Knowledge Base

This document provides a comprehensive technical overview of **ClawMotion**, a programmatic video motion engine designed for AI Agents. Use this as a reference when generating code, debugging, or extending the engine.

---

## 🏗️ Core Philosophy
1. **Agent-First**: Designed to be controlled by declarative manifests and typed blueprints with Zod schema validation.
2. **Isomorphic**: The logic core runs identically in Browser, Node.js, and Bun.
3. **Mathematical Determinism**: Custom seeded RNG and analytical math solver ensure frame-for-frame parity across renders.
4. **Deterministic Audio**: Audio is pre-analyzed into FFT frequency data so visuals react to frame-accurate audio bins without clock drift.
5. **GPU-Native / Headless**: Hardware-accelerated WebCodecs encoding in browser or high-performance Skia Canvas C++ bindings piped to FFmpeg in Node/Bun.
6. **Subpath Partitioning**: Subpaths (`@johnesleyer/clawmotion/core`, `@johnesleyer/clawmotion/client`, `@johnesleyer/clawmotion/server`, `@johnesleyer/clawmotion/blueprints`) prevent browser-side bundle leakage.

---

## 🏗️ Architecture & Subpaths

- **`@johnesleyer/clawmotion`**: Main package entry point.
- **`@johnesleyer/clawmotion/core`**: Core engine (`ClawEngine`, `defineBlueprint`, `BlueprintRegistry`, `ClawMath`, `ClawAnimator`, `AudioTrigger`).
- **`@johnesleyer/clawmotion/client`**: Client player & WebCodecs browser logic (`ClawPlayer`, `Compositor`, `AssetLoader`, `PostProcessor`, `WebCodecsEncoder`).
- **`@johnesleyer/clawmotion/server`**: Server-side render factory & audio processing (`MotionFactory`, `AudioAnalyzer`, `NodeEncoder`).
- **`@johnesleyer/clawmotion/blueprints`**: Built-in Pro blueprints (`ProBlueprints`).

---

## 📐 The Blueprint API

A **Blueprint** draws to a canvas context for a given frame.

### 1. Schema-Validated Blueprints (`defineBlueprint`)
Prefer using `defineBlueprint` with a Zod schema for AI tool usage and automatic prop validation:

```typescript
import { defineBlueprint } from '@johnesleyer/clawmotion/core';
import { z } from 'zod';

export const SpringBox = defineBlueprint({
    id: 'spring-box',
    description: 'A box that animates scale using analytical spring physics',
    schema: z.object({
        color: z.string().default('#22d3ee').describe('CSS color of the box'),
        stiffness: z.number().default(180).describe('Spring stiffness constant'),
        boxSize: z.number().default(120).describe('Width and height in pixels')
    }),
    run: (ctx) => {
        const { ctx: c, width, height, time, utils, props } = ctx;

        // props is typed and validated with default values applied
        const scale = utils.spring({
            from: 0,
            to: 1,
            time: time,
            stiffness: props.stiffness
        });

        c.save();
        c.translate(width / 2, height / 2);
        c.scale(scale, scale);
        c.fillStyle = props.color;
        c.fillRect(-props.boxSize / 2, -props.boxSize / 2, props.boxSize, props.boxSize);
        c.restore();
    }
});
```

### 2. Context API (`BlueprintContext`)
| Property | Type | Description |
| :--- | :--- | :--- |
| `ctx` | `ClawContext2D` | 2D Canvas drawing context. |
| `localTime` | `number` | Clip progress from `0.0` (start) to `1.0` (end). |
| `time` | `number` | Total global time in seconds. |
| `tick` | `number` | Global frame index. |
| `width / height` | `number` | Canvas dimensions. |
| `utils` | `ClawMath` | Deterministic math (`random()`, `range()`, `spring()`, `easeInOutQuad()`). |
| `props` | `Record<string, any>` | Merged static props and keyframe values. |
| `audio` | `{ volume, frequencies }` | Pre-baked RMS volume and FFT frequencies array (if audio present). |
| `getAsset(id)` | `function` | Retrieves pre-loaded image/video element (`HTMLImageElement` / `HTMLVideoElement`). |

---

## 📜 The Scene Format
Scenes are TypeScript/JavaScript files exporting a default scene object.

```typescript
import { SpringBox } from './blueprints/SpringBox';

export default {
    config: {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
        concurrency: 4,
        camera: { zoom: 1.0, x: 0, y: 0, shake: 0.0 }
    },
    blueprints: {
        'spring-box': SpringBox
    },
    clips: [
        {
            id: 'box-clip',
            blueprintId: 'spring-box',
            startTick: 0,
            durationTicks: 150,
            layer: 1,
            blendMode: 'normal', // 'normal' | 'multiply' | 'screen' | 'overlay' | 'add'
            props: { color: '#ec4899', stiffness: 220 },
            entry: { type: 'fade', durationTicks: 30 },
            exit: { type: 'zoom', durationTicks: 30 }
        }
    ],
    audio: {
        'main': './assets/music.mp3'
    },
    images: {
        'hero-img': './assets/hero.png'
    }
};
```

---

## ⚡ Animation System

### Keyframes
Clips support property keyframes with custom easing functions:
```typescript
clips: [{
    // ...
    animations: {
        fontSize: [
            { tick: 0, value: 40 },
            { tick: 45, value: 120, easing: 'easeOutQuad' },
            { tick: 90, value: 80, easing: 'easeInOutQuad' }
        ]
    }
}]
```
Supported easings: `linear`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInExpo`, `easeOutExpo`.

### Analytical Spring Physics
Compute exact closed-form spring position without frame-stepping history:
```typescript
const value = ctx.utils.spring({
    from: 0,
    to: 100,
    time: ctx.time,
    stiffness: 180, // k
    damping: 12,    // c
    mass: 1,        // m
    velocity: 0
});
```

### Camera Motion
Control camera zoom, panning, and shake globally or via keyframes:
```typescript
cameraAnimations: {
    zoom: [
        { tick: 0, value: 1.0 },
        { tick: 150, value: 1.4, easing: 'easeInOutQuad' }
    ],
    shake: [
        { tick: 45, value: 0.8 },
        { tick: 75, value: 0.0, easing: 'easeOutQuad' }
    ]
}
```

---

## 🚀 CLI Commands (LLM Reference)

When generating actions or instructions for users, use these CLI commands:

- `clawmotion init <name>`: Scaffolds a new scene directory with sample blueprint.
- `clawmotion preview <file>`: Launches the real-time browser preview player.
- `clawmotion render <file> [-o output.mp4] [-p concurrency]`: Renders scene to MP4.
- `clawmotion audit <file> [-o outDir] [-r ratios]`: Generates PNG snapshot keyframes and JSON report for Multimodal Vision models (GPT-4o, Gemini).
- `clawmotion schemas [file]`: Outputs JSON tool schemas of registered blueprints for LLM Function Calling.
- `clawmotion list`: Lists built-in Pro blueprints.
- `clawmotion serve`: Runs the render API server.

---

## 💎 Pro Blueprints
Built-in high-quality blueprints in `@johnesleyer/clawmotion/blueprints`:
- `gradient-bg`: Dynamic linear/radial backgrounds (`color1`, `color2`, `color3`).
- `text-hero`: Premium typography with shadows and drop-in motion (`text`, `fontSize`).
- `floaty-blobs`: Deterministic particles (`count`, `color`, `seed`).
- `image`: Hardware image drawing with scale animations (`assetId`, `x`, `y`, `width`, `height`).
- `glass-card`: Glassmorphism card container (`title`, `subtitle`, `x`, `y`, `w`, `h`).
- `vignette`: Cinematic corner shading (`intensity`, `color`).
- `video`: Frame-accurate background video clip playback (`assetId`, `width`, `height`).

---

## 🤖 AI Agent Workflow

1. **Extract Schemas**: Run `clawmotion schemas` to fetch tool definitions for prompt construction.
2. **Generate Scene & Blueprints**: Output valid TypeScript files with `defineBlueprint` and standard scene default export.
3. **Execute Preview / Render**: Run `clawmotion preview` or `clawmotion render`.
4. **Audit Visuals**: Execute `clawmotion audit` and analyze `.claw-audit/audit-report.json` and generated PNG snapshots using a vision model to verify layout, contrast, and alignment.
