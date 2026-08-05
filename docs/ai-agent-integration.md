# 🤖 AI Agent & LLM Integration

ClawMotion is built for **AI Agent control**, making it simple for LLMs to generate motion graphics and perform automated quality assurance.

---

## 🛠️ Tool Calling & Schema Generation

When prompting an LLM to build scenes, supply the JSON schemas of available blueprints:

```bash
clawmotion schemas scene.ts
```

Output format example:

```json
{
  "spring-box": {
    "id": "spring-box",
    "description": "A box that animates scale using analytical spring physics",
    "parameters": {
      "type": "object",
      "properties": {
        "color": { "type": "string", "default": "#22d3ee" },
        "stiffness": { "type": "number", "default": 180 },
        "boxSize": { "type": "number", "default": 120 }
      },
      "required": []
    }
  }
}
```

Feed this directly into the model's tool/function calling configuration. Each blueprint becomes a callable tool; the LLM returns `{ id, ...props }` values which the engine validates against the Zod schema before rendering.

---

## 🧠 Recommended System Prompt

```markdown
You are a ClawMotion scene engineer. You write TypeScript scene files
that export a default manifest with `config`, `blueprints`, and `clips`.

Rules:
- Blueprints are pure functions that render with a 2D canvas context.
- Use `defineBlueprint` + Zod schemas for validated, agent-safe props.
- Use `utils.spring` for natural motion, `utils.range` for deterministic randomness.
- Timelines are in ticks: `tick = seconds * fps`.
- Verify layouts with `clawmotion audit` and iterate on vision feedback.
```

---

## 👁️ Vision Feedback Loop (`clawmotion audit`)

AI Agents can verify their generated scenes by inspecting PNG snapshot keyframes:

```bash
clawmotion audit my-scene/scene.ts --outDir .claw-audit
```

This creates `.claw-audit/audit-report.json` alongside PNG frame snapshots:

```json
{
  "sceneFile": "my-scene/scene.ts",
  "config": { "width": 1280, "height": 720, "fps": 30, "duration": 5 },
  "snapshots": [
    {
      "tick": 37,
      "timeSeconds": 1.25,
      "ratio": 0.25,
      "imagePath": "/path/to/.claw-audit/snapshot_25pct_tick_37.png",
      "activeClips": [
        { "id": "bg", "blueprintId": "gradient-bg", "layer": 0 },
        { "id": "hero", "blueprintId": "text-hero", "layer": 1 }
      ]
    }
  ]
}
```

Pass the snapshot PNGs into a Multimodal Vision model (GPT-4o, Gemini 1.5 Pro) to self-correct text contrast, layout positioning, or temporal overlaps.

---

## 🔁 Automated Agent Loop

1. **Plan** — The LLM selects blueprints and props from exported schemas.
2. **Generate** — The agent writes/updates the scene file.
3. **Audit** — `clawmotion audit` renders keyframe PNGs + JSON.
4. **Review** — A Vision model critiques contrast, composition, and motion.
5. **Iterate** — Feedback is applied to props/keyframes; repeat until passing.
6. **Render** — `clawmotion render scene.ts -o final.mp4`.

---

## 💡 Tips

- Keep blueprint schemas tight (only expose tunable knobs) to reduce hallucinated props.
- Use `.describe()` on every Zod field so the LLM understands each parameter's intent.
- Snapshot ratios of `0.25, 0.5, 0.75` cover beginning, middle, and end of a scene.
