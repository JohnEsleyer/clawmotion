# 🦀 ClawMotion Documentation

Welcome to the **ClawMotion** documentation. ClawMotion is an isomorphic, programmatic video motion engine designed for AI Agents and developers.

---

## 📚 Table of Contents

1. [🚀 Getting Started](./getting-started.md) — Installation, first scene, previewing, and rendering.
2. [🎨 Blueprints API](./blueprints.md) — Creating custom blueprints, Zod schemas, and context APIs.
3. [📜 Scene Format](./scene-format.md) — Configuring scenes, clips, layers, transitions, and assets.
4. [⚡ Animation & Physics](./animation-and-physics.md) — Keyframes, easings, camera motion, and analytical spring physics.
5. [🎵 Audio Reactivity](./audio-reactivity.md) — Audio analysis, FFT frequency spectrums, and reactive visuals.
6. [🖥️ CLI Reference](./cli.md) — Command-line interface guide (`init`, `render`, `preview`, `audit`, etc.).
7. [🤖 AI Agent Integration](./ai-agent-integration.md) — Tool calling schemas, vision feedback loops, and LLM workflows.

---

## 🏗️ Architecture Subpaths

ClawMotion uses subpath exports to maintain a lightweight footprint across environments:

| Import Subpath | Use Case | Environment |
| :--- | :--- | :--- |
| `@johnesleyer/clawmotion` | Core isomorphic engine | Node.js, Bun, Browser |
| `@johnesleyer/clawmotion/core` | Core Engine, Blueprint Registry, Math, Context | Node.js, Bun, Browser |
| `@johnesleyer/clawmotion/client` | ClawPlayer, Compositor, WebCodecs Encoder | Browser |
| `@johnesleyer/clawmotion/server` | MotionFactory, AudioAnalyzer, NodeEncoder | Node.js / Bun |
| `@johnesleyer/clawmotion/blueprints` | Pre-built Pro Blueprints | Node.js, Bun, Browser |

---

## 🧠 Core Principles

- **Isomorphic** — The same blueprint code renders identically in Node.js, Bun, and the browser.
- **Deterministic** — Seeded pseudo-random math guarantees frame-for-frame reproducibility across environments.
- **Zero-Puppeteer** — Server rendering uses `skia-canvas` C++ bindings written directly to FFmpeg.
- **Agent-Native** — Zod-validated blueprints export JSON Schemas for LLM tool/function calling and vision feedback.
