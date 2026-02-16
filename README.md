# 🦀 ClawMotion (v0.2.0)

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Agent-First](https://img.shields.io/badge/AI-Agent--First-blueviolet)](https://github.com/JohnEsleyer/clawmotion)

**ClawMotion** is a high-precision, programmatic video motion engine designed specifically for AI Agents. It follows an "Agent-First" philosophy, where complex video sequences are defined as declarative JSON manifests and rendered with 100% parity between browser previews and server-side MP4 exports.

---

## ✨ Key Features

- **🚀 Unified Claw CLI**: Initialize projects, preview in real-time, and render to MP4 with a single tool.
- **🏗️ Isomorphic Core**: The same "Claw" logic runs in the browser for instant previews and in Node.js for production renders.
- **🧠 AI-Optimized**: Built for LLMs to generate manifests seamlessly. See [LLM.md](./LLM.md) for AI context.
- **🎲 Deterministic Math**: Seeded RNG and easing ensure every frame is mathematically identical across environments.
- **🎵 Audio-Visual Parity**: Built-in `AudioAnalyzer` extracts FFT data to drive reactive animations without real-time audio clock drift.
- **📦 Lightweight Subpaths**: Professional partitioning (e.g., `@clawmotion/server`) keeps client-side bundles free of Node dependencies.
- **🎞️ Parallel Rendering**: Distribute renders across multiple CPU cores via Puppeteer workers and FFmpeg stitching.

---

## 🚀 Quick Start

### 1. Installation

```bash
npm install @johnesleyer/clawmotion
npm run build:cli

# Optional: Link CLI globally
npm link
```

### 2. Scaffold a Scene
```bash
claw init my-cinematic-intro
```

### 3. Preview (Real-time)
Watch your scene come to life in the browser with full hot-reloading support:
```bash
claw preview my-cinematic-intro/scene.ts
```

### 4. Render (Production)
Export to high-quality MP4 using parallel GPU/CPU workers:
```bash
claw render my-cinematic-intro/scene.ts --output intro.mp4 --parallel 4
```

---

## 🏗️ Architecture & Subpaths

ClawMotion is strictly partitioned to ensure optimal bundle sizes:

- **`@johnesleyer/clawmotion/core`**: The logic orchestrator and deterministic math.
- **`@johnesleyer/clawmotion/client`**: The `ClawPlayer` for browser-based playback and interactivity.
- **`@johnesleyer/clawmotion/server`**: The `MotionFactory` (Puppeteer + FFmpeg bridge) for Node environments.
- **`@johnesleyer/clawmotion/blueprints`**: A collection of premium, pre-built drawing functions.

---

## 🎨 The Blueprint Pattern

Blueprints are pure functions that define "how" to draw. They are isolated, testable, and deterministic.

```typescript
import { BlueprintContext } from '@johnesleyer/clawmotion/core';

export const NeonPulse = (ctx: BlueprintContext) => {
    const { width, height, localTime, props, utils } = ctx;
    
    // Seeded random for consistent jitter
    const jitter = utils.range(-5, 5); 
    
    ctx.ctx.fillStyle = props.color || 'cyan';
    ctx.ctx.fillRect(width/2 - 50 + jitter, height/2 - 50, 100, 100);
};
```

---

## 📜 Scene Manifest (Declarative)

Define the "what" and "when" of your video intro:

```typescript
export default {
    config: { width: 1280, height: 720, fps: 30, duration: 5 },
    blueprints: { 'pulse': NeonPulse },
    clips: [
        {
            id: 'box-1',
            blueprintId: 'pulse',
            startTick: 0,
            durationTicks: 150,
            props: { color: 'magenta' },
            entry: { type: 'fade', durationTicks: 30 }
        }
    ]
};
```

---

## 🛠️ Tech Stack

- **TypeScript**: Typed logic core.
- **Canvas 2D / WebGL**: High-performance rendering targets.
- **Puppeteer**: Headless browser orchestration for frames.
- **FFmpeg**: Cinematic video encoding.
- **esbuild**: Lightning-fast client-side bundling.

---

## 🤖 AI & LLM Integration

ClawMotion is designed to be "written" by AI. We provide a specialized [LLM.md](./LLM.md) file that contains full code context, snippets, and rule-sets optimized for Claude, GPT, and Gemini.

---

## ⚖️ License

Distributed under the ISC License. See `LICENSE` for more information.
