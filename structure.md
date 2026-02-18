# Project Structure Guide

This file provides a quick reference for locating specific implementations within ClawMotion.

---

## Core Engine

| Implementation | Location |
|---------------|----------|
| Main Engine | `src/core/Engine.ts` |
| Clip Management | `src/core/Engine.ts` |
| Timeline Logic | `src/core/Engine.ts` |
| Blueprint Registry | `src/core/Blueprint.ts` |
| Render Context | `src/core/Context.ts` |
| ClawCanvas (Browser/Node) | `src/core/ClawCanvas.ts` |
| Deterministic Math | `src/core/Math.ts` |
| Animation Helpers | `src/core/Animator.ts` |
| Audio Triggers | `src/core/AudioTrigger.ts` |

---

## Client (Browser)

| Implementation | Location |
|---------------|----------|
| Player | `src/client/Player.ts` |
| Compositor | `src/client/Compositor.ts` |
| Asset Loader | `src/client/AssetLoader.ts` |
| Post Processor | `src/client/PostProcessor.ts` |
| WebCodecs Encoder | `src/client/WebCodecsEncoder.ts` |
| Client Entry | `src/client/index.ts` |

---

## Server (Node.js)

| Implementation | Location |
|---------------|----------|
| Motion Factory | `src/server/Factory.ts` |
| Skia Canvas Bridge | `src/server/NodeEncoder.ts` |
| Audio Analyzer | `src/server/AudioAnalyzer.ts` |
| Preview HTML | `src/server/preview.html` |
| Server Entry | `src/server/index.ts` |

---

## CLI

| Implementation | Location |
|---------------|----------|
| Main CLI | `src/cli/claw.ts` |

---

## Blueprints

| Implementation | Location |
|---------------|----------|
| Pre-built Blueprints | `src/blueprints/ProBlueprints.ts` |

---

## Examples

| Example | Location |
|---------|----------|
| All Examples | `examples/` |

---

## Key Classes

- **`ClawEngine`** (`src/core/Engine.ts`) - Main orchestration engine
- **`ClawPlayer`** (`src/client/Player.ts`) - Browser-based playback
- **`MotionFactory`** (`src/server/Factory.ts`) - Server-side rendering
- **`Compositor`** (`src/client/Compositor.ts`) - Layer composition
- **`AudioAnalyzer`** (`src/server/AudioAnalyzer.ts`) - FFT audio analysis
- **`NodeEncoder`** (`src/server/NodeEncoder.ts`) - Skia Canvas to FFmpeg bridge
- **`WebCodecsEncoder`** (`src/client/WebCodecsEncoder.ts`) - Hardware-accelerated browser encoding
