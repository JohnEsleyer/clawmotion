# 🎨 Blueprints API

A **Blueprint** in ClawMotion is a pure rendering function responsible for drawing visual elements on a 2D canvas context for a given frame.

---

## 📐 Defining Blueprints

### 1. Functional Blueprints

A Blueprint can be a simple function receiving a `BlueprintContext`:

```typescript
import { BlueprintContext } from '@johnesleyer/clawmotion/core';

export const SimpleBox = (ctx: BlueprintContext) => {
    const { width, height, localTime, props } = ctx;
    const size = props.size || 100;

    ctx.ctx.fillStyle = props.color || 'red';
    ctx.ctx.fillRect((width - size) * localTime, height / 2 - size / 2, size, size);
};
```

### 2. Schema-Validated Blueprints (`defineBlueprint`)

For AI Agent integration and strict prop validation, wrap your blueprint with `defineBlueprint` and a Zod schema.

```typescript
import { defineBlueprint } from '@johnesleyer/clawmotion/core';
import { z } from 'zod';

export const SpringBox = defineBlueprint({
    id: 'spring-box',
    description: 'A box that animates scale using analytical spring physics',
    schema: z.object({
        color: z.string().default('#22d3ee').describe('Hex or CSS color of the box'),
        stiffness: z.number().default(180).describe('Spring stiffness parameter'),
        boxSize: z.number().default(120).describe('Width and height of the box')
    }),
    run: (ctx) => {
        const { ctx: c, width, height, time, utils, props } = ctx;

        // props is automatically typed and validated against the Zod schema
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

The engine automatically runs `schema.safeParse()` on the merged props before invoking `run`, applying Zod defaults and stripping invalid keys.

---

## 🛠️ BlueprintContext Reference

| Property | Type | Description |
| :--- | :--- | :--- |
| `ctx` | `ClawContext2D` | Standard 2D Canvas context (`fillStyle`, `fillRect`, `arc`, etc.). |
| `localTime` | `number` | Progress through the clip duration from `0.0` (start) to `1.0` (end). |
| `time` | `number` | Total elapsed global time in seconds. |
| `tick` | `number` | Current frame number (e.g. frame 45). |
| `width` | `number` | Canvas width in pixels. |
| `height` | `number` | Canvas height in pixels. |
| `utils` | `ClawMath` | Deterministic math library (`random()`, `range()`, `spring()`, `easeInOutQuad()`). |
| `props` | `Record<string, any>` | Merged static parameters and resolved keyframe values. |
| `audio` | `{ volume, frequencies }` | Pre-baked audio FFT data for the current frame (if audio track active). |
| `getAsset(id)` | `(id: string) => any` | Retrieves pre-loaded images or HTMLVideoElement instances. |

---

## 🖼️ Using Assets Inside a Blueprint

```typescript
export const Logo = (ctx: BlueprintContext) => {
    const { ctx: c, props, getAsset } = ctx;
    const img = getAsset(props.assetId);
    if (!img) return;

    c.drawImage(img, props.x || 0, props.y || 0);
};
```

---

## 💎 Built-in Pro Blueprints

ClawMotion comes with ready-to-use Pro blueprints:

```typescript
import { ProBlueprints } from '@johnesleyer/clawmotion/blueprints';
```

- **`gradient-bg`**: Dynamic gradient background (`color1`, `color2`, `color3`).
- **`text-hero`**: High-end typography with opacity drop-ins and drop shadows (`text`, `fontSize`).
- **`floaty-blobs`**: Deterministic background ambient particles (`count`, `color`, `seed`).
- **`image`**: Image renderer with smooth scale motion (`assetId`, `x`, `y`, `width`, `height`).
- **`glass-card`**: Glassmorphism container with blur and border effects (`title`, `subtitle`, `x`, `y`, `w`, `h`).
- **`vignette`**: Radial shadow overlay (`intensity`, `color`).
- **`video`**: Frame-synced video layer (`assetId`, `width`, `height`).

To see the full list from the CLI:

```bash
clawmotion list
```
