# ⚡ Animation & Physics

ClawMotion supports keyframe animations, camera movements, deterministic pseudo-random mathematics, and analytical spring solvers.

---

## 🎞️ Keyframe Animations

Animations can be attached directly to properties within clip definitions:

```typescript
clips: [
    {
        id: 'animated-text',
        blueprintId: 'text-hero',
        startTick: 0,
        durationTicks: 150,
        animations: {
            fontSize: [
                { tick: 0, value: 40 },
                { tick: 45, value: 120, easing: 'easeOutQuad' },
                { tick: 150, value: 80, easing: 'easeInOutQuad' }
            ],
            text: [
                { tick: 0, value: 'INITIALIZING' },
                { tick: 60, value: 'CLAW MOTION READY' }
            ]
        }
    }
]
```

The engine resolves each animated property to a concrete value for the current local tick and merges it into `props` before your blueprint runs.

---

## 📈 Supported Easing Functions

Available easings for keyframes:

- `linear`
- `easeInQuad`, `easeOutQuad`, `easeInOutQuad`
- `easeInCubic`, `easeOutCubic`, `easeInOutCubic`
- `easeInExpo`, `easeOutExpo`

---

## 🎲 Deterministic Randomness (`ClawMath`)

All randomness is produced by a seeded **Linear Congruential Generator**, guaranteeing identical output across environments:

```typescript
const { utils } = ctx;

const roll = utils.random();          // 0.0 <= roll < 1.0
const x = utils.range(0, width);      // number between 0 and width
```

| Method | Signature | Description |
| :--- | :--- | :--- |
| `random()` | `() => number` | Next deterministic pseudo-random number in `[0, 1)`. |
| `range(min, max)` | `(number, number) => number` | Deterministic number in `[min, max)`. |
| `lerp(a, b, t)` | `(number, number, number) => number` | Linear interpolation (static). |
| `clamp(v, min, max)` | `(number, number, number) => number` | Clamps a value (static). |

---

## 🌀 Analytical Spring Physics (`utils.spring`)

Unlike traditional frame-by-frame Euler integration, ClawMotion uses a closed-form analytical spring solver. This means spring position can be computed at any arbitrary timestamp instantly.

```typescript
const scale = ctx.utils.spring({
    from: 0,         // Starting value (default: 0)
    to: 1,           // Target value (default: 1)
    time: ctx.time,  // Time in seconds
    stiffness: 200,  // k stiffness constant (default: 180)
    damping: 10,     // c damping factor (default: 12)
    mass: 1,         // m mass (default: 1)
    velocity: 0      // Initial velocity (default: 0)
});
```

The solver automatically selects the correct regime:

- **Underdamped** (`ζ < 1`): oscillates and settles.
- **Critically damped** (`ζ ≈ 1`): settles fastest without oscillation.
- **Overdamped** (`ζ > 1`): approaches target slowly without oscillation.

---

## 🎥 Camera Animations

Control global pan, zoom, and deterministic rumble/shake via camera configurations:

```typescript
export default {
    config: {
        width: 1280,
        height: 720,
        fps: 30,
        duration: 5,
        camera: {
            zoom: 1.0,
            x: 0,
            y: 0,
            shake: 0.0
        }
    },
    cameraAnimations: {
        zoom: [
            { tick: 0, value: 1.0 },
            { tick: 150, value: 1.5, easing: 'easeInOutQuad' }
        ],
        shake: [
            { tick: 40, value: 0.0 },
            { tick: 45, value: 0.8 }, // Impact peak
            { tick: 75, value: 0.0, easing: 'easeOutQuad' }
        ]
    }
    // ...
};
```

| Camera Property | Type | Description |
| :--- | :--- | :--- |
| `zoom` | `number` | Global scale factor (default `1`). |
| `x` / `y` | `number` | Pan offset in pixels. |
| `shake` | `number` | Rumble intensity `0-1`; computed deterministically from the frame number. |
