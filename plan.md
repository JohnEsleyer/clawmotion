# 🦀 ClawMotion v1.0 Architecture

## Current Implementation

ClawMotion v1.0 uses a **GPU-Native** architecture that achieves 100% parity between browser preview and server export.

---

## 🎯 Architecture Goals

1. **100% Client-Server Parity**: Same rendering code runs in browser and produces identical output
2. **Native Execution**: Uses WebCodecs (VideoEncoder) in browser for hardware-accelerated encoding
3. **Deterministic Math**: Seeded RNG and easing ensure frame-for-frame parity
4. **GPU Acceleration**: Hardware-accelerated video encoding (NVENC, Apple Silicon, etc.)

---

## 🏗️ Render Pipeline

### Option 1: Browser-Based Export (100% Parity)
```
OffscreenCanvas → VideoEncoder (WebCodecs) → MP4
```
- **Preview**: Real-time playback in browser
- **Export**: Same code path as preview, just capture frames to VideoEncoder
- **Parity**: ✅ 100% (exact same rendering)

### Option 2: Server-Based Export (Fast, Skia)
```
Skia Canvas → FFmpeg stdin pipe → MP4
```
- Headless rendering in Node.js
- Uses `skia-canvas` for high-performance 2D rendering
- Fast but may have minor rendering differences from browser

---

## 🔄 How 100% Parity Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser (Preview + Export)                    │
├─────────────────────────────────────────────────────────────────┤
│  ClawEngine → OffscreenCanvas → ClawPlayer (Preview)           │
│                         ↓                                        │
│              VideoEncoder (WebCodecs)                           │
│                         ↓                                        │
│                    MP4 Download                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Same Blueprint Code
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Server (Node.js - Optional)                   │
├─────────────────────────────────────────────────────────────────┤
│  ClawEngine → Skia Canvas → FFmpeg → MP4                       │
│  (Use when browser export not available)                        │
└─────────────────────────────────────────────────────────────────┘
```

The key insight: **The browser IS the rendering engine**. We just capture its output instead of displaying it.

---

## 🚀 Why This Works

### No Emulation Needed
- **Old approach**: Try to run browser code in Node using Puppeteer
- **v1.0 approach**: Run the actual browser, just without display

### Hardware Acceleration
- **WebCodecs**: Uses dedicated GPU (NVENC, Apple Silicon, Intel QuickSync)
- **Software encoding**: Not needed - browser handles GPU encoding natively

### Two Export Modes

| Mode | Parity | Speed | Use Case |
|------|--------|-------|----------|
| Browser (WebCodecs) | 100% | Fast | Production, exact replica |
| Server (Skia) | ~99% | Fastest | Quick previews, CI/CD |

---

## 🛠️ Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser Rendering | OffscreenCanvas | Canvas 2D in web workers |
| Browser Encoding | VideoEncoder (WebCodecs) | Hardware GPU encoding |
| Server Rendering | skia-canvas | High-performance C++ canvas |
| Server Encoding | FFmpeg | Professional video encoding |
| Audio Analysis | FFT (fft-js) | Pre-analyzed frequency data |

---

## ✅ What's Implemented

- [x] Isomorphic Blueprint execution
- [x] Skia Canvas + FFmpeg server pipeline
- [x] WebCodecs browser pipeline
- [x] Browser-based export (renderViaBrowser method)
- [x] Deterministic seeded RNG
- [x] Keyframe animation system
- [x] Entry/Exit transitions
- [x] Audio-reactive visuals (pre-analyzed FFT)
- [x] Layer composition and blending
- [x] Camera animations (zoom, pan, shake)
- [x] CLI with init, preview, render commands
- [x] ClawStudio IDE

---

## 📌 Technical Notes

### Browser Export Flow
1. Factory starts a local HTTP server with inline HTML
2. HTML contains full rendering logic (same as preview)
3. Uses VideoEncoder to capture frames
4. Sends final MP4 back to server

### Skia vs Browser Rendering
While Skia is excellent, minor differences exist:
- Font rendering (metrics, kerning)
- Gradient interpolation
- Anti-aliasing algorithms

For **exact** parity, use browser-based export.

---

## 📌 Future Enhancements

These are potential future directions:

- [ ] Headless browser automation for fully server-side browser export
- [ ] WebGPU rendering pipeline for even faster GPU utilization
- [ ] Shader plugins for custom effects
- [ ] AI-based procedural effects

---

## 📌 Summary

ClawMotion v1.0 achieves **100% parity** by using the browser as the rendering engine for both preview and export:

- **Preview**: Real-time Canvas + Player
- **Export**: Same Canvas → VideoEncoder → MP4

This eliminates the need for Puppeteer or emulation while giving you hardware-accelerated, identical output.
