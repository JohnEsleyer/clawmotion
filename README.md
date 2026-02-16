# 🦀 ClawMotion

**ClawMotion** is a high-precision, programmatic video motion engine designed specifically for AI Agents. It follows an "Agent-First" philosophy, where complex video sequences are defined as declarative JSON-like manifests and rendered with 100% parity between browser previews and server-side MP4 exports.

## ✨ Key Features

- **Isomorphic Core**: The same "Claw" (logic engine) runs in the browser for instant previews and in Node.js for production renders.
- **Deterministic Math**: Custom seeded RNG and easing functions ensure every frame is mathematically identical across environments.
- **Audio-Visual Parity**: Built-in `AudioAnalyzer` extracts frequency and volume data to drive deterministic animations without relying on real-time browser audio APIs.
- **Declarative Transitions**: Automatic handling of `fade`, `slide`, and `zoom` transitions via clip metadata—no manual interpolation code required in blueprints.
- **Asset Management**: Centralized pre-loading of images and audio for flicker-free rendering.
- **FFmpeg Integration**: High-performance frame piping into `libx264` for cinematic MP4 outputs.

## 🏗️ Architecture

- **`src/core`**: The orchestrator (`ClawEngine`), deterministic math (`ClawMath`), and Registry system.
- **`src/client`**: The `ClawPlayer` for browser-based animation loops and interactivity.
- **`src/server`**: The `MotionFactory` (Puppeteer + FFmpeg bridge) and `AudioAnalyzer`.
- **`src/blueprints`**: Pure, isolated drawing functions (the "how" of the visuals).

## 🚀 Getting Started

### Installation

```bash
npm install
```

### Run Examples

**1. Basic Hello World**
```bash
npx ts-node examples/hello-world.ts
```

**2. Audio-Reactive Visualizer**
```bash
npx ts-node examples/audio-viz.ts
```

**3. Professional Cinematic Showcase**
```bash
npx ts-node examples/full-showcase.ts
```

**4. Transition System Demo**
```bash
npx ts-node examples/transitions.ts
```

## 🎨 Creative Blueprinting

ClawMotion uses **Blueprints**—pure functions that receive a drawing context and the engine state.

```typescript
const MyBlueprint = (ctx: BlueprintContext) => {
    const { width, height, localTime, props } = ctx;
    ctx.ctx.fillStyle = props.color;
    ctx.ctx.fillRect(0, 0, width * localTime, height);
};
```

## 🛠️ Tech Stack

- **TypeScript** (Core logic)
- **Canvas 2D** (Rendering target)
- **Puppeteer** (Headless browser orchestration)
- **FFmpeg** (Video encoding)
- **esbuild** (Fast client-side bundling)

---
Built by Antigravity for the next generation of AI content creation.
