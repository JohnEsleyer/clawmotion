# 🚀 Getting Started with ClawMotion

ClawMotion allows you to programmatically define and render frame-exact motion graphics using standard TypeScript and 2D Canvas APIs.

---

## 📦 Installation

Install ClawMotion into your project using your preferred package manager:

```bash
# Bun
bun add @johnesleyer/clawmotion

# NPM
npm install @johnesleyer/clawmotion

# Yarn
yarn add @johnesleyer/clawmotion
```

---

## 🛠️ Quickstart CLI Workflow

### 1. Initialize a Project
Run the `init` command to scaffold a new scene directory:

```bash
npx clawmotion init my-scene
```

This generates:

```
my-scene/
├── scene.ts
└── blueprints/
    └── RectBlueprint.ts
```

### 2. Preview in Real Time
Launch the interactive browser player:

```bash
npx clawmotion preview my-scene/scene.ts
```

### 3. Render to Video
Render your scene into an MP4 file using parallel server rendering:

```bash
npx clawmotion render my-scene/scene.ts -o output.mp4
```

---

## 📝 Example Scene File

Here is what a complete scene definition (`scene.ts`) looks like:

```typescript
import { BlueprintContext } from '@johnesleyer/clawmotion/core';

// 1. Define a custom blueprint
const PulseCircle = (ctx: BlueprintContext) => {
    const { width, height, localTime, props } = ctx;
    const radius = 50 + Math.sin(localTime * Math.PI * 2) * 30;

    ctx.ctx.fillStyle = props.color || '#22d3ee';
    ctx.ctx.beginPath();
    ctx.ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.ctx.fill();
};

// 2. Export default scene manifest
export default {
    config: {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5, // 5 seconds
        concurrency: 4
    },
    blueprints: {
        'pulse-circle': PulseCircle
    },
    clips: [
        {
            id: 'circle-1',
            blueprintId: 'pulse-circle',
            startTick: 0,
            durationTicks: 150, // 5s * 30fps
            props: { color: '#ec4899' },
            entry: { type: 'fade', durationTicks: 30 },
            exit: { type: 'zoom', durationTicks: 30 }
        }
    ]
};
```

---

## 🗂️ Project Layout

A typical ClawMotion project keeps blueprints and scenes in separate files:

```
my-project/
├── scene.ts                  # Scene manifest (config, clips, assets)
├── blueprints/
│   ├── SpringBox.ts          # Schema-validated blueprint
│   └── RectBlueprint.ts      # Functional blueprint
└── assets/
    ├── logo.png
    └── music.mp3
```

---

## 💡 Next Steps

- Learn how to build **[Blueprints](./blueprints.md)** with Zod schemas.
- Understand the full **[Scene Format](./scene-format.md)** for layers, transitions, and assets.
- Add **[Animation & Physics](./animation-and-physics.md)** with keyframes and springs.
