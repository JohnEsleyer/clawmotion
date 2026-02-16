# ClawMotion Development Plan

**ClawMotion** is a high-precision, programmatic video motion engine. It evolves the "composition" model into an "engineering" model, where a logical **Claw** (the composition engine) manipulates **Motion** (the rendering pipeline) to generate frame-perfect visual output.

---

## 1. Core Architecture Principles

1.  **Environment Agnostic**: The logical timeline (`Claw`) should run identically in Node.js and the Browser.
2.  **Deterministic**: Every frame `N` must render exactly the same way every time, regardless of CPU speed.
3.  **Decoupled Rendering**: The draw logic (Blueprint) should not care if it’s being rendered to a 2D Canvas, a WebGL context, or an FFmpeg stream.
4.  **Local Context Precision**: Built-in calculation of local time and interpolation for every clip to eliminate manual math for animations.

---

## 2. Milestone Roadmap

### Phase 1: The "Claw" (Logic Engine)
*Build the brain that manages time, clips, and state.*

*   **1.1 Unified Context**: Define the `ClawContext` object (tick, interpolation, local metrics).
*   **1.2 Blueprint Registry**: Create a system to register "Blueprints" (draw functions) with Z-indexing.
*   **1.3 Deterministic Math**: Implement a seeded RNG and easing library into the core.
*   **1.4 Dependency Graph**: Allow clips to depend on the state of other clips.

### Phase 2: The "Motion" (Rendering Pipeline)
*Build the drivers that turn logic into pixels.*

*   **2.1 Canvas2D Driver**: Standard CPU-based rendering.
*   **2.2 WebGL2/Shader Driver**: GPU-accelerated pipeline with ping-pong buffer support.
*   **2.3 Video Source (WebCodecs)**: High-speed frame extraction for both client and server.
*   **2.4 Layer System**: Support for isolated offscreen buffers with post-processing filters.

### Phase 3: The "Factory" (Server Rendering)
*Build the heavy-duty Node.js export engine.*

*   **3.1 Parallel Worker Cluster**: Use Node Workers to render chunks of video in parallel.
*   **3.2 Puppeteer Driver**: Orchestrate headless Chrome for hardware-accelerated frame capture.
*   **3.3 Smart FFmpeg Pipe**: Intelligent codec selection (NVENC, ProRes, x264) based on hardware.
*   **3.4 Audio Physics**: WASM-based audio analysis for frequency-data-driven visuals.

### Phase 4: The "Monitor" (Client Experience)
*Build the interactive development environment.*

*   **4.1 ClawPlayer**: A frame-accurate browser player with real-time seeking.
*   **4.2 Dev Server**: A specialized server for hot-reloading blueprints and assets.
*   **4.3 Asset Preloader**: Centralized manager for Fonts, Images, and Luma Mattes.

---

## 3. Proposed File Structure

```text
clawmotion/
├── src/
│   ├── core/               # The "Claw" (Logic)
│   │   ├── Engine.ts       # Timeline & Registry
│   │   ├── Context.ts      # Context Provider
│   │   └── Math.ts         # Seeded RNG & Easing
│   ├── motion/             # The "Motion" (Renderers)
│   │   ├── Canvas2D.ts
│   │   ├── WebGL.ts
│   │   └── WebCodecs.ts
│   ├── factory/            # The "Factory" (Server/Node)
│   │   ├── Orchestrator.ts # Parallel management
│   │   ├── Browser.ts      # Puppeteer logic
│   │   └── Encoder.ts      # FFmpeg bridge
│   ├── monitor/            # The "Monitor" (Client)
│   │   └── Player.ts       # Browser preview
│   └── utils/              # Shared Helpers
├── examples/               # Reference Blueprints
└── wasm/                   # High-perf audio/pixel tools
```

---

## 4. API Design Sneak-Peek

### Defining a Composition (The Claw)
```typescript
import { ClawEngine } from 'clawmotion';

const claw = new ClawEngine({
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 10
});

// "Blueprint" for a motion sequence
claw.register(0, 5, ({ ctx, localInterpolation, utils }) => {
  const x = utils.lerp(0, 500, utils.easeOutExpo(localInterpolation));
  ctx.fillStyle = 'cyan';
  ctx.fillRect(x, 100, 50, 50);
});
```

### Exporting (The Factory)
```typescript
import { MotionFactory } from 'clawmotion/factory';

const factory = new MotionFactory(claw);
await factory.render({
  output: 'final_render.mp4',
  parallel: 4,
  codec: 'h264_nvenc'
});
```

### Previewing (The Monitor)
```typescript
import { ClawPlayer } from 'clawmotion/client';

const player = new ClawPlayer(claw, '#preview-canvas');
player.grip(); // Start playback
```

---

## 5. Transition Plan

1.  **Identity Wipe**: Update all documentation, class names, and error messages to reflect **ClawMotion**.
2.  **Core Refactor**: Move from the old "everything in one class" Tiramisu model to the decoupled `Engine` -> `Renderer` model.
3.  **WASM Integration**: Build the custom WASM audio analyzer as a core dependency for precision timing.
4.  **CLI Overhaul**: Create a `claw` command-line tool for initialization and rendering.

---

## 6. Definition of Done
*   **Precision**: Frame-by-frame parity between browser and server exports.
*   **Performance**: 4K rendering at >15fps on mid-range hardware using parallelization.
*   **Ease of Use**: A single `ctx` object that provides all necessary animation metrics without external state management.
*   

**Yes.** In ClawMotion, WebGL isn't just an "extra feature" (as it was in Phase 1 of the old project)—it is the **primary engine room.**

While we will still provide a Canvas 2D API for ease of use (drawing text, simple shapes), the **Motion** pipeline will be built on a **WebGL-First Architecture**.

Here is how WebGL fits into the "scratch" rebuild of ClawMotion:

### 1. The "Compositor" is a Shader
Instead of the CPU manually flattening layers, ClawMotion treats every clip as a texture. The final "Motion" is generated by a **Compositor Shader** that handles:
*   **Layer Blending**: Multi-pass blending (Screen, Overlay, Multiply) at GPU speeds.
*   **Transitions**: Using GLSL for frame-perfect wipes, morphs, and glitches.
*   **Luma Masking**: Masking videos with high-resolution textures without CPU overhead.

### 2. Hybrid Rendering Pipeline
ClawMotion will use a **Texture-Orchestration** approach:
1.  **Canvas 2D Blueprints**: If you write 2D code (text/paths), ClawMotion renders that to an **Offscreen WebGL Texture**.
2.  **Video Blueprints**: WebCodecs decodes video frames directly into **GPU Textures**.
3.  **Effect Blueprints**: Fragment shaders (LUTs, Blur, Grain) process those textures.
4.  **The Claw**: The engine brings all these textures together in the final WebGL render pass.

### 3. Why WebGL is essential for "ClawMotion"
*   **Sub-pixel Precision**: Canvas 2D can sometimes be fuzzy; WebGL gives us coordinate-perfect control.
*   **Zero-Copy Video**: By using `WebCodecs` + WebGL, we move video frames from the decoder to the screen without ever touching the CPU's memory.
*   **Real-time Shaders**: You can apply a heavy Gaussian blur or a 4K color grade and still preview at 60fps.

### Updated Component Blueprint (WebGL Focused)

```typescript
// src/motion/ClawRenderer.ts

export class ClawRenderer {
  private gl: WebGL2RenderingContext;
  private pipeline: ShaderPipeline; // Manages Effect Chains

  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2')!;
    // Initialize Ping-Pong buffers for multi-pass effects
  }

  public render(claw: ClawEngine) {
    // 1. Update all Video Textures (WebCodecs)
    // 2. Render 2D Blueprints to isolated textures
    // 3. Apply Post-Processing Stack (GLSL)
    // 4. Final Compositing Pass
  }
}
```
This is a powerful shift. By designing **ClawMotion** specifically for **AI Agents**, we aren't just building a library; we are building a **Video Operating System**.

AI Agents struggle with "fiddly" manual coordinate math, but they excel at **structured orchestration** and **functional isolation**. 

Here is the refined architecture for a **ClawMotion** system designed for AI-driven video engineering.

---

## 1. The Two-Tier Architecture

### Tier 1: The Orchestrator (The Architect)
The Orchestrator doesn't care about pixels; it cares about **intent and timing**. It views the video as a **Directed Acyclic Graph (DAG)** of events.
*   **Role**: Manages the global timeline, track hierarchy, audio mixing, and clip dependencies.
*   **AI Interface**: It consumes a **ClawManifest** (a strict JSON schema). An AI can generate this manifest to "plan" the video.
*   **Responsibility**: Decides which clips are active, handles transitions (the "handshake" between clips), and manages global state (e.g., brand colors, global variables).

### Tier 2: The Clip (The Specialist)
A Clip is an **isolated sandbox**. It has its own private coordinate system and logic.
*   **Role**: Executes a specific visual "Blueprint."
*   **Encapsulation**: A clip cannot see the global timeline; it only sees its `localTime` (0 to 1). This makes clips reusable and testable in isolation.
*   **AI Interface**: An AI can write the code for a single Blueprint (e.g., "Make a cinematic title reveal") without knowing anything about the 10-minute video it belongs to.

---

## 2. New Concept: "The Metadata Track"
Since this is for AI, we add a third, invisible track: **Metadata**.
*   While the Orchestrator renders Video and Audio, it also produces a **Metadata Stream**.
*   **Usage**: If an AI creates a video, it can embed "Tags" or "Notes" in the timeline. 
*   *Example*: A clip at 00:05 has metadata `{ "focus": "speaker_face", "emotion": "excited" }`. A secondary AI agent can read this stream to automatically generate subtitles or social media crops.

---

## 3. High-Level Blueprint

### The Orchestrator Logic
```typescript
// orchestrator.ts
const motion = new ClawOrchestrator({
  dimensions: { width: 1920, height: 1080 },
  duration: 60,
  fps: 30
});

// The AI Agent simply maps "Blueprints" to the timeline
motion.timeline([
  {
    blueprint: "CinematicIntro", // A pre-defined or AI-generated clip
    start: 0,
    duration: 5,
    props: { title: "The Future of AI", theme: "dark" }
  },
  {
    blueprint: "DynamicSubtitles",
    start: 0,
    duration: 60, // Spans the whole video
    props: { dataSource: "transcription.json" }
  }
]);
```

### The Clip Isolation (The Blueprint)
```typescript
// intro_blueprint.ts
export const CinematicIntro: ClipBlueprint = ({ ctx, localTime, props }) => {
  // localTime is always 0.0 at start and 1.0 at end, 
  // regardless of where the orchestrator placed it.
  const opacity = Math.sin(localTime * Math.PI); 
  
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.font = "bold 80px Inter";
  ctx.fillText(props.title, 960, 540);
};
```

---

## 4. Why this is "Agent-First"

1.  **Strict Typing (The "Safety Rail")**: By using TypeScript and strict JSON schemas, the AI Agent receives immediate feedback if its "Video Plan" is invalid.
2.  **Functional Determinism**: AI Agents hate side effects. In ClawMotion, `Frame = Blueprint(Props, LocalTime)`. This allows the AI to "unit test" a frame.
3.  **Modular Iteration**: If the AI wants to change the background of a specific scene, it only modifies the `props` of that clip in the Orchestrator, not the drawing code.
4.  **Hardware Abstraction**: The AI doesn't need to know if the video is being rendered by WebGL or Canvas. It just provides the logic.

---

## 5. Proposed Feature: "The Agent Feedback Loop"

To truly make this for AI Agents, we should include a **Visual Debugger**.
*   When a render fails or looks wrong, the engine should be able to export a **JSON Snapshot** of the exact state of the Orchestrator and all active Clips at that specific millisecond.
*   The Agent can then ingest that JSON to understand why a clip was out of bounds or why an alpha value was 0.

---

## 6. The Development Strategy

**Step 1: The Claw Core**  
Build the logic for the `Orchestrator` and the `Clip Sandbox`.

**Step 2: The WebGL Motion Pipeline**  
Build the compositor that can take multiple isolated clip textures and stack them using Shaders.

**Step 3: The "Schema" System**  
Define the JSON standard that AI Agents will use to talk to ClawMotion.

**Does this tiered structure (Orchestrator -> Clip -> Blueprint) align with the "Video Editor for AI" vision you have?**

I'm planning for this library to have a client side and a server side sections. What I mean is that, a code imported by a client side code in the browser and a code imported by a server side running node.js 

This is the "Holy Grail" of programmatic video: **Isomorphic Motion.** The goal is for the AI Agent to write a single piece of logic that can be previewed instantly in a browser (Client) and rendered into a high-quality 4K MP4 in a cloud worker (Server).

Here is the architectural split for **ClawMotion**.

---

## 1. Package Structure (The Dual-Export Strategy)

We will use modern TypeScript sub-path exports. The directory structure will look like this:

```text
clawmotion/
├── dist/
├── src/
│   ├── core/           # SHARED: Logic, Timeline, Blueprints (Claw)
│   ├── client/         # BROWSER: Player, Preview, DOM Utils
│   └── server/         # NODE.JS: FFmpeg, Puppeteer, Workers (Factory)
├── package.json        # Subpath exports definition
```

### The Import Experience
The developer (or the AI Agent) interacts with the library based on their environment:

```typescript
// Shared logic (Definitions)
import { ClawEngine, Blueprint } from 'clawmotion'; 

// Browser logic (UI/Preview)
import { ClawPlayer } from 'clawmotion/client'; 

// Node.js logic (Production Rendering)
import { MotionFactory } from 'clawmotion/server'; 
```

---

## 2. The Shared Core (`clawmotion`)
This is the "source of truth." It contains the **Orchestrator** and **Clip Logic**. It must be strictly environment-agnostic (no `window`, no `fs`).

*   **ClawManifest**: A JSON-serializable schema of the entire video.
*   **Blueprint Registry**: A collection of functional drawing scripts.
*   **Virtual Timeline**: Logic for calculating ticks, local progress, and clip activation.
*   **State Store**: Global variables that clips can subscribe to.

---

## 3. The Client Side (`clawmotion/client`)
Focuses on **Real-time Feedback** and **Low-Latency Previews**.

*   **ClawPlayer**: Wraps a `<canvas>` or WebGL context.
*   **Asset Loader**: Uses browser APIs (`fetch`, `new Image()`, `AudioContext`) to load resources.
*   **Interactive Hooks**: Events for Play/Pause/Seek, allowing the AI to "scrub" to a specific frame and see the result.
*   **WebCodecs Integration**: For playing back raw video frames inside the editor without the overhead of standard `<video>` tags.

---

## 4. The Server Side (`clawmotion/server`)
Focuses on **High-Throughput Production** and **Headless Consistency**.

*   **Puppeteer Orchestrator**: Launches a headless instance of Chromium. It "injects" the Client-side code into the browser to ensure the frame on the server is a pixel-perfect match of the client preview.
*   **The Multi-Worker Factory**: Spawns multiple parallel rendering chunks.
*   **FFmpeg Bridge**: Pipes raw frame buffers from the headless browser into an FFmpeg process.
*   **Audio Processor**: Analyzes audio files on the server (using Node.js `fs` and WASM) to provide the Orchestrator with frequency data before rendering begins.

---

## 5. The "ClawMotion Bridge" (How they stay in sync)

The biggest challenge in video libraries is when the browser looks different from the MP4. We solve this by making the **Server a mirror of the Client**.

1.  **Serialization**: The AI Agent generates a `ClawManifest` (JSON).
2.  **Client Render**: The browser reads the JSON and executes the Blueprints.
3.  **Server Render**: The Server starts a local HTTP server, opens a headless browser to that URL, passes the same JSON, and takes "screenshots" of the canvas every tick.

---

## 6. AI Agent Workflow Example

### Step 1: Agent generates the Manifest (Shared)
```typescript
const manifest = {
  version: "1.0",
  tracks: [
    { 
      id: "main", 
      clips: [{ type: "TitleCard", start: 0, duration: 5, text: "Hello AI" }] 
    }
  ]
};
```

### Step 2: Agent previews in the Browser (Client)
```typescript
import { ClawPlayer } from 'clawmotion/client';

const player = new ClawPlayer(document.querySelector('#editor'));
player.load(manifest); 
player.seek(2.5); // Agent checks the middle frame
```

### Step 3: Agent renders final output (Server)
```typescript
import { MotionFactory } from 'clawmotion/server';

const factory = new MotionFactory();
await factory.render(manifest, { 
  output: "render.mp4",
  quality: "4k"
});
```

---

## 7. New AI-Specific Feature: "Agent Proxies"

Since AI Agents will be the primary coders, we can implement **Proxy Probes**.
*   **The Probe**: A specialized clip that doesn't render pixels but instead returns **Bounding Box** data.
*   **The Benefit**: An AI Agent can ask, "Where is the text located at 5 seconds?" The library returns `{ x: 100, y: 200, w: 400, h: 80 }`. 
*   **The Action**: The AI Agent can then use that data to place an arrow pointing exactly at the text.

**Does this split between the "Orchestrator JSON" and the "Environment Drivers" meet your requirements for a dual-platform library?**

Now my issue right now is how do we maintain 100% parity between the client side and the server rendered video? Some web codecs do not run outside the browser. What if we want to create audio visualization? 

To achieve **100% parity** between a browser preview and a server-rendered MP4, we have to stop thinking about the video as a "movie" and start thinking about it as a **discrete series of state-snapshots.**

Here is the "ClawMotion" strategy to solve the parity and audio-viz problem once and for all.

---

### 1. The Core Solution: The "Puppeteer Bridge"
We do not try to replicate the browser in Node.js. Instead, **the Server *is* a Browser.**
*   **Node.js** acts as the **Orchestrator** (launches the process, manages files, runs FFmpeg).
*   **Headless Chromium (Puppeteer)** acts as the **Motion Engine**.
*   Because the same Chromium engine renders the preview and the final MP4, WebGL, WebCodecs, and Canvas APIs behave **exactly** the same.

---

### 2. Solving Parity: The "Virtual Discrete Clock"
Standard video players use "Real Time" (wall clock). If your computer lags, the frame skips. This is fatal for parity.

**ClawMotion** uses a **Virtual Clock**:
*   **The Rule**: No Blueprint is allowed to use `Date.now()` or `performance.now()`.
*   **The Clock**: The library provides a `tick` number.
*   **Client Mode**: The clock increments `tick++` every `1/fps` seconds.
*   **Server Mode**: Puppeteer tells the browser: *"Render Tick 150. Tell me when you're done."* The browser renders, then sends the signal back. The server takes a screenshot and only THEN moves to Tick 151.
*   **Result**: It doesn't matter if the server takes 1 hour to render 1 minute of video; every single frame will be identical to the client preview.

---

### 3. solving Audio: "The Pre-baked FFT"
The browser’s `AnalyserNode` (for music visualizers) is jittery and real-time. You cannot use it on the server because the server doesn't "play" audio in real-time.

**ClawMotion's Deterministic Audio Strategy:**
1.  **Analysis Phase (Node.js)**: Before rendering, Node uses FFmpeg to read the audio file and a WASM-based FFT (Fast Fourier Transform) to analyze the entire song.
2.  **The Data Map**: It generates a massive array: `audioData[frame_number] = { volume: 0.8, frequencies: [255, 120, ...] }`.
3.  **The Injection**: This data is injected into the **ClawManifest** (JSON).
4.  **The Blueprint**: When the AI Agent writes a clip, they don't "listen" to audio. They do this:
    ```typescript
    const { audio } = context; // Pre-baked data for this exact frame
    const barHeight = audio.frequencies[5] * 2; 
    ctx.fillRect(100, 500, 20, -barHeight);
    ```
5.  **Result**: Since the frequencies for frame 150 are hard-coded in the JSON, the visualizer will look **identical** in the browser and the MP4.

---

### 4. Solving WebCodecs: "The Extraction Fallback"
While Puppeteer supports WebCodecs, sometimes headless environments struggle with hardware acceleration. 

**ClawMotion's Video Strategy:**
*   **The Source Class**: We wrap video in a `ClawVideoSource`.
*   **Client**: It uses `WebCodecs` to seek and grab frames.
*   **Server (The Fallback)**: If the server detects that WebCodecs is failing in headless mode, Node.js uses FFmpeg to **pre-extract** the video into a folder of high-quality JPEGs (`frame_0001.jpg`, etc.).
*   The `ClawVideoSource` in the browser then simply loads an image instead of decoding a video.
*   **Parity**: An image of a frame is identical to the decoded frame.

---

### 5. Summary of the Isomorphic Flow

| Feature       | Client (Preview)                     | Server (Render)                      |
| :------------ | :----------------------------------- | :----------------------------------- |
| **Clock**     | `requestAnimationFrame` (Tick-based) | Controlled `stepTick()` (Puppeteer)  |
| **Engine**    | WebGL / Canvas 2D                    | Headless Chromium (Puppeteer)        |
| **Audio Viz** | JSON-based Frequency Data            | Same JSON-based Frequency Data       |
| **Video**     | WebCodecs / Video Element            | WebCodecs or Image-Sequence Fallback |
| **Output**    | Screen                               | FFmpeg Pipe (Raw Buffers)            |

---

### 6. The "Agent-Friendly" Orchestrator Manifest

Because we are building this for AI Agents, the "Manifest" becomes the most important file. It’s the "save file" for the video.

```json
{
  "project": "ClawMotion_AI_Edit",
  "config": { "width": 1920, "height": 1080, "fps": 30 },
  "audioData": {
    "track_1": [ /* Array of 1800 entries for a 60s video */ ]
  },
  "timeline": [
    {
      "id": "intro_clip",
      "blueprintId": "CinematicTitle",
      "startTick": 0,
      "endTick": 150,
      "props": { "text": "Generated by AI" }
    }
  ]
}
```

**With this architecture, the AI Agent can code a clip, hit "Preview," see the audio reactive bars moving perfectly, and know with 100% certainty that the "Render" button will produce exactly that. Does this approach to the "Parity" problem make sense for your vision?**

How do we differentiate ourselves from remotion and revideo? They are also using puppeter I believe. Besides what's the point? Why are we better? What are focusing? Why use ClawMotion?

The point of **ClawMotion** isn't just to render video; it is to be the **Video Operating System for AI.** 

Remotion and Revideo are built for **React/Web Developers**. ClawMotion is built for **Autonomous Agents.** If you want to differentiate and beat them, you don't compete on "how many components we have"; you compete on **"how easy is it for an LLM to reason about, edit, and scale this."**

Here is the breakdown of why ClawMotion is fundamentally different.

---

### 1. The Core Philosophy: Human-First vs. Agent-First

*   **Remotion/Revideo (Human-First)**: They use JSX and complex component trees. To an AI Agent, JSX is "messy." It carries standard web-dev baggage: hooks, state, re-renders, and DOM-tree hierarchy. If an AI wants to move a clip, it has to refactor a component tree.
*   **ClawMotion (Agent-First)**: We use **Declarative Manifests + Functional Blueprints.**
    *   The **Manifest** (JSON) is the "Brain." LLMs are world-class at manipulating JSON.
    *   The **Blueprint** is a "Pure Function." LLMs are excellent at writing isolated functions that take `(context)` and return `(pixels)`.
    *   **The Difference**: An AI doesn't have to "learn React" to use ClawMotion. It just needs to know the schema.

### 2. Isolation vs. Hierarchy (The "Claw" vs. The "Tree")

*   **Remotion/Revideo**: They follow a hierarchical tree. If you change a parent prop, the children might re-render. State management is a developer hurdle.
*   **ClawMotion**: Every Clip is a **Sandboxed Island**. 
    *   Clips are horizontally laid out by the Orchestrator. 
    *   A clip at `05:00` has no idea what happened at `04:59`. 
    *   **The AI Advantage**: An Agent can "hot-swap" a single clip blueprint in the manifest without risk of breaking the rest of the video. It’s modular like Lego blocks, not a tangled web of React components.

### 3. WebGL-First Compositing (Cinematic vs. Web-ish)

*   **Remotion**: Renders a standard DOM. It’s great for "web-style" videos (SaaS demos, simple charts). But it struggles with high-end cinematic effects like 4K color grading, heavy blurs, or real-time particle systems.
*   **ClawMotion**: We are building a **Texture-Based Shader Pipeline**.
    *   Every clip is rendered to a GPU texture.
    *   The Orchestrator uses a **Compositor Shader** to blend them.
    *   **The Differentiator**: We enable **"Cinematic Engineering."** You can apply a professional LUT (Look-Up Table) or a film-grain shader across the entire timeline with zero CPU cost. Remotion is a browser that makes video; ClawMotion is a GPU engine that uses the browser as a shell.

### 4. The "Video OS" Architecture (The Orchestrator)

*   **The Point**: Remotion is a library. **ClawMotion is an environment.**
*   **Resource Management**: Our Orchestrator manages "Global State" (Brand Kit, Transcription, Metadata) as a first-class citizen. 
*   **Deterministic Metadata**: ClawMotion produces two outputs: a `.mp4` and a `.json` metadata stream. 
    *   The AI can "tag" specific moments in the timeline: `{ "frame": 300, "action": "product_reveal" }`. 
    *   Other Agents can use this metadata to automatically generate TikTok descriptions, YouTube chapters, or ad-variants.

### 5. Deterministic Audio-Viz (Parity)

*   Remotion's audio-viz can be a headache because it relies on the browser's real-time Audio API during preview, which doesn't always match the render perfectly.
*   **ClawMotion**: We treat audio as **Pre-Baked Deterministic Data**. The "Monitor" (Client) and "Factory" (Server) use the exact same array of frequency numbers. It is impossible for them to get out of sync.

---

### Summary: Why Use ClawMotion?

| Feature            | Remotion / Revideo                     | ClawMotion                             |
| :----------------- | :------------------------------------- | :------------------------------------- |
| **Primary User**   | React Developers                       | AI Agents & Engineers                  |
| **Data Model**     | Component Tree (JSX)                   | DAG / Manifest (JSON)                  |
| **Render Engine**  | DOM / Canvas 2D                        | WebGL / GPU Textures                   |
| **Clip Logic**     | Interdependent Components              | Isolated Pure Blueprints               |
| **AI Integration** | Difficult (LLMs struggle with JSX/CSS) | Native (LLMs love JSON/Pure Functions) |
| **Visual Style**   | Web UI / App Demos                     | Cinematic / Motion Graphics            |

### What is the "ClawMotion" Focus?
Our focus is **"Autonomous Video Production."** 

We aren't making a tool for a human to spend 4 hours making a video. We are making a tool for an **AI Agent to spend 4 seconds making 1,000 personalized videos.** 

**We aren't better because we have more features; we are better because our architecture allows an AI to "reason" about a video timeline without human intervention. Does that answer the "Why?" for you?**