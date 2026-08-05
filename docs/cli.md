# 🖥️ CLI Reference

The `clawmotion` command-line utility helps you scaffold, preview, audit, and render scenes.

---

## 📋 Summary of Commands

| Command | Usage | Description |
| :--- | :--- | :--- |
| `init` | `clawmotion init [name]` | Creates a new ClawMotion scene template. |
| `preview` | `clawmotion preview <file>` | Starts local HTTP preview server. |
| `render` | `clawmotion render <file> [options]` | Renders scene file to MP4 video. |
| `audit` | `clawmotion audit <file> [options]` | Generates snapshot images & JSON report for LLM Vision models. |
| `schemas` | `clawmotion schemas [file]` | Outputs JSON schemas for AI Agent tool calling. |
| `list` | `clawmotion list` | Lists built-in Pro blueprints. |
| `serve` | `clawmotion serve` | Starts standalone render API server. |

---

## 🔍 Detailed Usage & Options

### `clawmotion init`

Scaffolds a new scene directory with a sample blueprint and scene file.

```bash
clawmotion init my-scene
```

| Argument | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | `my-scene` | Name of the scene/project directory. |

### `clawmotion preview`

Starts a local HTTP server that bundles and serves an interactive browser preview of your scene.

```bash
clawmotion preview path/to/scene.ts
```

### `clawmotion render`

Renders a scene file to MP4 format using FFmpeg and Skia Canvas.

```bash
clawmotion render path/to/scene.ts -o dist/output.mp4 -p 8
```

| Option | Description | Default |
| :--- | :--- | :--- |
| `-o, --output <path>` | Destination video path. | `output.mp4` |
| `-p, --parallel <n>` | Parallel concurrency threads. | `4` |

### `clawmotion audit`

Generates keyframe snapshots and a structured audit report JSON file.

```bash
clawmotion audit scene.ts -o .audit-results -r 0.2,0.5,0.8
```

| Option | Description | Default |
| :--- | :--- | :--- |
| `-o, --outDir <dir>` | Directory where snapshots and reports are stored. | `.claw-audit` |
| `-r, --ratios <list>` | Comma-separated frame ratios to snapshot. | `0.25,0.5,0.75` |

### `clawmotion schemas`

Outputs JSON schema mappings of registered blueprints to `stdout` for LLM system prompt injection:

```bash
clawmotion schemas scene.ts > tools.json
```

### `clawmotion list`

Prints the IDs of all built-in Pro blueprints.

```bash
clawmotion list
```

### `clawmotion serve`

Starts the standalone render API server on port `3001`, serving the project landing page and the `/api/render` endpoint.

```bash
clawmotion serve
```

---

## 🎯 Exit Codes

- `0` — Success.
- `1` — Scene file missing, invalid scene format, or render/audit failure.
