# 📜 Scene Format Guide

Scenes in ClawMotion are defined as plain JavaScript/TypeScript objects exported as `default`.

---

## 📑 Scene Schema

```typescript
import { ClawConfig, Clip } from '@johnesleyer/clawmotion/core';

interface SceneManifest {
    config: ClawConfig;
    blueprints?: Record<string, any>;
    clips: Clip[];
    audio?: Record<string, string>;
    images?: Record<string, string>;
    cameraAnimations?: Record<string, Keyframe[]>;
}
```

---

## ⚙️ Configuration (`config`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `width` | `number` | Required | Render width in pixels (e.g. `1280` or `1920`). |
| `height` | `number` | Required | Render height in pixels (e.g. `720` or `1080`). |
| `fps` | `number` | Required | Frames per second (e.g. `30` or `60`). |
| `duration` | `number` | Required | Total scene duration in seconds. |
| `concurrency` | `number` | `1` | Number of parallel render chunks/workers. |
| `camera` | `CameraConfig` | `undefined` | Camera zoom, pan, and shake defaults. |
| `effects` | `EffectsConfig` | `undefined` | Post-processing effects (`bloom`, `chromatic`, `vignette`). |

---

## 🎬 Clips (`clips`)

Each clip represents an active blueprint instance on the timeline.

```typescript
clips: [
    {
        id: 'headline',
        blueprintId: 'text-hero',
        startTick: 30,          // Starts at frame 30 (1 second at 30fps)
        durationTicks: 120,     // Lasts 120 frames (4 seconds)
        layer: 5,               // Render layer (higher numbers render on top)
        blendMode: 'normal',    // 'normal' | 'multiply' | 'screen' | 'overlay' | 'add'
        props: {
            text: 'AI MOTION ENGINE',
            fontSize: 90
        },
        entry: {
            type: 'slide',       // 'fade' | 'slide' | 'zoom'
            durationTicks: 20
        },
        exit: {
            type: 'fade',
            durationTicks: 20
        }
    }
]
```

---

## 🎚️ Layer Ordering & Blend Modes

- Clips are sorted by `layer` (ascending) and then by `startTick`. Higher `layer` values render on top.
- `blendMode` controls how a clip composites onto the canvas: `normal`, `multiply`, `screen`, `overlay`, or `add`.

---

## 🔁 Transitions

Every clip supports automatic entry and exit transitions:

| Type | Effect |
| :--- | :--- |
| `fade` | Opacity ramps from `0` to `1` (entry) or `1` to `0` (exit). |
| `slide` | Translates the clip vertically into/out of place. |
| `zoom` | Scales from `0.9x` to `1x` on entry, reverse on exit. |

---

## 🎵 Audio & Asset Mapping

Assets are declared in the manifest and loaded before playback or rendering:

```typescript
export default {
    // ...
    audio: {
        'main': './assets/music.mp3'
    },
    images: {
        'logo': './assets/logo.png',
        'bg-video': './assets/cinematic-bg.mp4'
    }
};
```

---

## 💡 Full Example

```typescript
export default {
    config: {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5
    },
    blueprints: {
        'gradient-bg': GradientBg,
        'text-hero': TextHero
    },
    clips: [
        { id: 'bg', blueprintId: 'gradient-bg', startTick: 0, durationTicks: 150, layer: 0 },
        { id: 'title', blueprintId: 'text-hero', startTick: 15, durationTicks: 135, layer: 1, props: { text: 'CLAW MOTION' } }
    ],
    cameraAnimations: {
        zoom: [
            { tick: 0, value: 1.0 },
            { tick: 150, value: 1.2, easing: 'easeInOutQuad' }
        ]
    }
};
```
