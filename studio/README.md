# ClawStudio

ClawStudio is the visual IDE for ClawMotion projects.

## Start from your workspace

Use the CLI from any directory:

```bash
clawmotion studio
```

The directory where you run the command becomes the Studio workspace. Imported assets are copied to:

```text
<workspace>/assets
```

## Features

- **Visual Timeline Editor**: Drag and drop clips, adjust timing
- **Real-time Preview**: See changes instantly in the browser
- **AI Assistant**: Describe what you want to build, AI generates the code
- **Audio Analysis**: Upload audio files, detect beats and segments
- **Export to MP4**: Render high-quality videos with hardware acceleration

## Architecture

ClawStudio uses:
- **React 19** with Vite for the UI
- **ClawEngine** (browser version) for preview rendering
- **OffscreenCanvas** + **WebCodecs** for hardware-accelerated preview
- **Puter.js** for free AI assistant (no API key required)

## Development

```bash
cd studio
npm install
npm run dev
```
