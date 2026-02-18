# 🦀 ClawMotion | LLM Context & Knowledge Base

This document provides a comprehensive technical overview of **ClawMotion**, a programmatic video motion engine designed for AI Agents. Use this as a reference when generating code, debugging, or extending the engine.

---

## 🏗️ Core Philosophy
1. **Agent-First**: Designed to be controlled by declarative manifests.
2. **Isomorphic**: The logic core runs identically in the Browser and Node.js.
3. **Mathematical Determinism**: Custom seeded RNG and easing ensure frame-for-frame parity across different renders.
4. **Deterministic Audio**: Audio is pre-analyzed. Visuals react to baked frequency data (FFT) rather than real-time audio clocks.
5. **GPU-Native**: Uses WebCodecs (VideoEncoder) in browser for hardware-accelerated encoding.
6. **Subpath Partitioning**: Uses professional subpath exports (e.g., `@johnesleyer/clawmotion/server`) to prevent browser-side "leakage" of heavy Node dependencies.

---

## 🏗️ Architecture & Subpaths
ClawMotion uses a single "isomorphic" package with strictly partitioned subpaths to maintain a lightweight footprint in the browser.

- **`@johnesleyer/clawmotion`** (Default): Contains the Isomorphic Core (`ClawEngine`, `ClawMath`). Safest for all environments.
- **`@johnesleyer/clawmotion/core`**: Deep-access to core engine logic.
- **`@johnesleyer/clawmotion/client`**: Player, AssetLoader, and browser-only rendering logic.
- **`@johnesleyer/clawmotion/server`**: MotionFactory, Skia Canvas bridge, and FFmpeg logic. (Node only).
- **`@johnesleyer/clawmotion/blueprints`**: Direct access to pre-built Pro blueprints.

---

## ⚡ Render Pipeline

### Browser (Preview)
```
OffscreenCanvas → VideoEncoder (WebCodecs) → WebM/MP4
```
- Uses hardware GPU acceleration (NVENC, Apple Silicon, etc.)
- Fastest for real-time preview

### Server (Production)
```
Skia Canvas → FFmpeg stdin pipe → MP4
```
- Headless rendering in Node.js
- Parallel frame rendering across workers

---

## 📐 The Blueprint Pattern
A **Blueprint** is a pure function that draws to a canvas.

```typescript
import { BlueprintContext } from '@johnesleyer/clawmotion/core';

export const MyBlueprint = (ctx: BlueprintContext) => {
    const { width, height, localTime, props, utils } = ctx;
    
    // localTime: 0.0 (start of clip) to 1.0 (end of clip)
    const x = utils.range(0, width) * localTime; 
    
    ctx.ctx.fillStyle = props.color || 'white';
    ctx.ctx.fillRect(x, height / 2, 100, 100);
};
```

### Context API (`BlueprintContext`)
| Property | Description |
| :--- | :--- |
| `ctx` | `CanvasRenderingContext2D` |
| `localTime` | Progressive value (0-1) for the current clip duration. |
| `tick` | The global frame index. |
| `width / height` | Canvas dimensions. |
| `utils` | Instance of `ClawMath` (seeded RNG, lerp, clamp). |
| `props` | Custom parameters passed from the manifest. |
| `audio` | `{ volume: number, frequencies: number[] }` (if enabled). |
| `getAsset(id)` | Retrieves pre-loaded `Image` or `HTMLVideoElement`. |

---

## 📜 The Scene Format (v0.2.0+)
Scenes are defined as TypeScript/JavaScript objects exported as `default`.

```typescript
export default {
    config: {
        width: 1920,
        height: 1080,
        fps: 60,
        duration: 10,
        concurrency: 8, // Parallel render workers
        camera: { zoom: 1.2, x: 0, y: 0 }
    },
    blueprints: {
        'my-animation': MyBlueprint
    },
    clips: [
        {
            id: 'intro',
            blueprintId: 'my-animation',
            startTick: 0,
            durationTicks: 120,
            props: { color: '#ff0055' },
            entry: { type: 'fade', durationTicks: 30 },
            exit: { type: 'zoom', durationTicks: 30 }
        }
    ],
    audio: {
        'main': './background-music.mp3'
    },
    images: {
        'logo': './assets/logo.png'
    }
};
```

---

## ⚡ Animation System
ClawMotion supports **keyframe-based** property interpolation or **time-based** manual drawing.

### Keyframes
Animations can be declared in the clip manifest:
```typescript
clips: [{
    // ...
    animations: {
        x: [
            { tick: 0, value: 0, easing: 'easeOutQuad' },
            { tick: 60, value: 500 }
        ]
    }
}]
```
The engine automatically interpolates these values and makes them available in `ctx.props`.

---

## 🚀 CLI Usage (LLM Instruction Guide)
When the user asks to render or preview, prioritize these commands:

- `clawmotion init <name>`: Scaffolds a new scene.
- `clawmotion preview <path>`: Opens the real-time browser preview.
- `clawmotion render <path>`: Renders terminal-to-MP4.
- `clawmotion list`: Shows all built-in Pro blueprints.
- `clawmotion studio`: Start ClawStudio visual editor.
- `clawmotion studio -o`: Start studio and open in browser.

---

## 💎 Pro Blueprints
Built-in high-quality blueprints:
- `gradient-bg`: Dynamic linear/radial backgrounds.
- `text-hero`: Premium typography with shadows and entry motion.
- `floaty-blobs`: Deterministic particles.
- `glass-card`: Glassmorphism effect UI.
- `vignette`: Cinematic corners.
- `video`: High-performance video background/overlay.

---

## 🛠️ Common Patterns & Tips

### 1. Deterministic Randomness
Never use `Math.random()`. Always use `ctx.utils.random()`.
```typescript
const jitter = ctx.utils.range(-5, 5); // Consistent across every render
```

### 2. Audio Reactivity
Use `ctx.audio.frequencies` (array of normalized floats).
```typescript
const bass = ctx.audio.frequencies[0]; // 0.0 to 1.0
const size = 100 + (bass * 50);
```

### 3. Layering
Clips are sorted by `layer` (default 0). Higher layers render on top.
```typescript
{ id: 'bg', layer: -1, ... },
{ id: 'overlay', layer: 10, ... }
```

### 4. Transitions
Transitions (`entry`, `exit`) are handled automatically by the engine. The `localTime` and `opacity` are pre-calculated. Do not manually interpolate unless you need custom exotic logic.
