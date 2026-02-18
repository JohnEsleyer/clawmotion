# 🦀 ClawMotion (v0.2.0)

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Agent-First](https://img.shields.io/badge/AI-Agent--First-blueviolet)](https://github.com/JohnEsleyer/clawmotion)

**ClawMotion** is a high-precision, programmatic video motion engine designed for AI Agents. Create complex video sequences using declarative blueprints and render with 100% parity between browser preview and server export.

---

## ✨ Key Features

- **🏗️ Isomorphic Core**: Same Blueprint logic runs in browser and Node.js
- **🎯 100% Parity**: Browser-based export ensures identical preview and output
- **🧠 AI-Optimized**: Declarative manifests easy for LLMs to generate. See [LLM.md](./LLM.md)
- **🎲 Deterministic Math**: Seeded RNG and easing for frame-perfect reproducibility
- **⚡ GPU-Native**: WebCodecs (VideoEncoder) for hardware-accelerated encoding
- **🎵 Audio-Reactive**: FFT-analyzed audio drives visual animations
- **📦 Modular Exports**: `@johnesleyer/clawmotion/core`, `client`, `server`, `blueprints`
- **🎞️ Fast Rendering**: Skia Canvas + FFmpeg for server-side production

---

## 📋 Requirements

```bash
# Ubuntu/Debian
sudo apt-get install -y ffmpeg
```

- **FFmpeg**: Video encoding (included in server pipeline)

---

## 🚀 Quick Start

### Installation

```bash
npm install @johnesleyer/clawmotion
npm run build
```

### Use in Node.js

```typescript
import { ClawEngine, Clip } from '@johnesleyer/clawmotion/core';
import { MotionFactory } from '@johnesleyer/clawmotion/server';
import { ProBlueprints } from '@johnesleyer/clawmotion/blueprints';

const config = {
    width: 1280,
    height: 720,
    fps: 30,
    duration: 5
};

const clips: Clip[] = [
    {
        id: 'my-clip',
        blueprintId: 'gradient-bg',  // Built-in blueprint
        startTick: 0,
        durationTicks: 150,
        props: { color1: '#1a2a6c', color2: '#b21f1f' }
    }
];

const factory = new MotionFactory();
await factory.render(config, clips, './output.mp4');
```

### Run Examples

```bash
npx ts-node examples/hello-world.ts
npx ts-node examples/transitions.ts
npx ts-node examples/keyframes.ts
```

### ClawStudio (Visual Editor)

```bash
# From any folder - that folder becomes your workspace
clawmotion studio

# Or with explicit workspace
CLAWMOTION_WORKSPACE=/path/to/folder npm run studio
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ClawMotion                                │
├───────────────────────┬─────────────────────────────────────────┤
│    Browser (Preview)  │           Server (Node.js)              │
├───────────────────────┼─────────────────────────────────────────┤
│  • ClawEngine         │  • MotionFactory                        │
│  • ClawPlayer        │  • Skia Canvas                          │
│  • OffscreenCanvas   │  • FFmpeg Pipeline                     │
│  • VideoEncoder      │  • Fast rendering                       │
│  (100% parity)       │                                         │
└───────────────────────┴─────────────────────────────────────────┘
                          │
                   Shared Core
          (Blueprints, Math, Animator)
```

### Render Modes

| Mode | Parity | Speed | Use Case |
|------|--------|-------|----------|
| Browser (WebCodecs) | 100% | Fast | Production, exact replica |
| Server (Skia) | ~99% | Fastest | Quick previews |

---

## 🎨 The Blueprint Pattern

Blueprints are pure functions that define "how" to draw:

```typescript
import { BlueprintContext } from '@johnesleyer/clawmotion/core';

export const NeonPulse = (ctx: BlueprintContext) => {
    const { width, height, localTime, props, utils } = ctx;
    
    const jitter = utils.range(-5, 5);  // Deterministic
    
    ctx.ctx.fillStyle = props.color || 'cyan';
    ctx.ctx.fillRect(width/2 - 50 + jitter, height/2 - 50, 100, 100);
};
```

### Built-in Blueprints

- `gradient-bg` - Animated gradient backgrounds
- `text-hero` - Premium typography
- `floaty-blobs` - Deterministic particles
- `glass-card` - Glassmorphism UI
- `vignette` - Cinematic corners
- `video` - Video overlays

---

## 📜 Clip Definition

```typescript
const clip = {
    id: 'my-clip',
    blueprintId: 'gradient-bg',
    startTick: 0,
    durationTicks: 150,
    props: { color1: '#1a2a6c', color2: '#b21f1f' },
    entry: { type: 'fade', durationTicks: 30 },
    exit: { type: 'zoom', durationTicks: 30 },
    layer: 0,
    blendMode: 'normal'
};
```

### Transitions

Built-in transitions: `fade`, `slide`, `zoom`

### Animations

```typescript
const clip = {
    // ...
    animations: {
        x: [
            { tick: 0, value: 0, easing: 'easeOutQuad' },
            { tick: 60, value: 500 }
        ],
        opacity: [
            { tick: 0, value: 0 },
            { tick: 30, value: 1 }
        ]
    }
};
```

---

## 🛠️ Tech Stack

- **TypeScript** - Type-safe core
- **OffscreenCanvas** - Browser rendering
- **WebCodecs** - Hardware-accelerated encoding
- **Skia Canvas** - Node.js rendering
- **FFmpeg** - Video encoding
- **esbuild** - Fast bundling

---

## 📁 Project Structure

```
clawmotion/
├── src/
│   ├── core/          # Engine, Math, Animator, Blueprint types
│   ├── client/         # Player, Compositor, WebCodecs encoder
│   ├── server/         # Factory, NodeEncoder, FFmpeg
│   ├── blueprints/     # ProBlueprints library
│   └── cli/            # clawmotion CLI
├── examples/           # Usage examples
└── studio/             # ClawStudio visual editor
```

---

## 🤖 AI Integration

See [LLM.md](./LLM.md) for AI agent context, code snippets, and best practices.

---

## ⚖️ License

ISC License. See `LICENSE` file.
