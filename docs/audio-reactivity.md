# 🎵 Audio Reactivity

ClawMotion isolates visual generation from real-time audio clock drift by pre-analyzing audio files into frame-synchronous FFT frequency data.

---

## 📊 Pre-Baked Audio FFT Data

When audio files are included in scene configs, ClawMotion extracts:

1. **`volume`**: Normalized Root Mean Square (RMS) loudness.
2. **`frequencies`**: An array of frequency magnitudes binned across the audio spectrum (default: 16-32 bins).

Inside blueprints, accessing audio data is straightforward:

```typescript
export const AudioEqualizer = (ctx: BlueprintContext) => {
    const { width, height, audio, ctx: c } = ctx;
    if (!audio) return;

    const bins = audio.frequencies.length;
    const barWidth = width / bins;

    // 1. Draw Frequency Spectrum Bars
    for (let i = 0; i < bins; i++) {
        const barHeight = audio.frequencies[i] * 400;
        c.fillStyle = `hsl(${i * 20}, 100%, 50%)`;
        c.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
    }

    // 2. Pulse background on volume peaks
    const bgOpacity = audio.volume * 0.5;
    c.fillStyle = `rgba(255, 255, 255, ${bgOpacity})`;
    c.fillRect(0, 0, width, height);
};
```

---

## 🎚️ Analyzing a Track

In the scene manifest, map a track to a file path. The CLI analyzes it before rendering:

```typescript
export default {
    // ...
    audio: {
        'main': './assets/music.mp3'
    }
};
```

The resulting frame array is attached to the engine as `audioData` and exposed per frame via `ctx.audio`.

---

## ⚡ Automated Keyframe Generation (`AudioTrigger`)

You can generate keyframes automatically from audio analysis peaks using `AudioTrigger`:

```typescript
import { AudioTrigger } from '@johnesleyer/clawmotion/core';

const keyframes = AudioTrigger.generateKeyframes(audioFrameArray, {
    threshold: 0.6,
    type: 'volume', // or 'frequency'
    frequencyBin: 2, // Required if type is 'frequency'
    cooldownTicks: 15,
    reaction: {
        durationTicks: 10,
        peakValue: 1.5,
        baseValue: 1.0,
        easing: 'easeOutQuad'
    }
});
```

| Option | Type | Description |
| :--- | :--- | :--- |
| `threshold` | `number` | Minimum value that triggers a reaction. |
| `type` | `'volume' \| 'frequency'` | Which metric to scan. |
| `frequencyBin` | `number` | Bin index required when `type` is `'frequency'`. |
| `cooldownTicks` | `number` | Minimum frames between consecutive triggers. |
| `reaction.durationTicks` | `number` | Length of the keyframe reaction. |
| `reaction.peakValue` | `any` | Value at the reaction peak. |
| `reaction.baseValue` | `any` | Value before and after the reaction. |
| `reaction.easing` | `string` | Easing to apply on the peak and fall-off. |

The returned keyframes can be attached directly to a clip's `animations` property:

```typescript
clips: [
    {
        id: 'pulse',
        blueprintId: 'glass-card',
        startTick: 0,
        durationTicks: 300,
        animations: {
            scale: keyframes
        }
    }
]
```
