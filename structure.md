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

---

## Client (Browser)

| Implementation | Location |
|---------------|----------|
| Player | `src/client/Player.ts` |
| Compositor | `src/client/Compositor.ts` |
| Asset Loader | `src/client/AssetLoader.ts` |
| Post Processor | `src/client/PostProcessor.ts` |
| Client Entry | `src/client/index.ts` |

---

## Server (Node.js)

| Implementation | Location |
|---------------|----------|
| Motion Factory | `src/server/Factory.ts` |
| Puppeteer Bridge | `src/server/PuppeteerBridge.ts` |
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
- **`PuppeteerBridge`** (`src/server/PuppeteerBridge.ts`) - Browser frame capture

---

## Utilities

| Implementation | Location |
|---------------|----------|
| Deterministic Math | `src/core/Math.ts` |
| Animation Helpers | `src/core/Animator.ts` |
| Audio Triggers | `src/core/AudioTrigger.ts` |
