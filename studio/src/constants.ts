
export const CLAW_GUIDE = `
# ClawStudio Orchestration Guide

ClawStudio uses a two-tier programmatic approach:

## 1. The Orchestrator (orchestrator.ts)
This script controls the project timeline. Use the 'claw' object to schedule clips.
- claw.addClip({ id: "id", blueprintId: "builtin", startTick: 0, durationTicks: 150, props: {} })
- claw.setDuration(seconds)

Example:
claw.setDuration(10);
claw.addClip({
  id: 'bg-1',
  blueprintId: 'background.claw',
  startTick: 0,
  durationTicks: 300,
  layer: 0
});

## 2. Blueprints (*.claw)
Blueprints are drawing functions. Each file should return an arrow function.
- (ctx: BlueprintContext) => { ... }

Context properties:
- ctx: Canvas2D context
- width/height: Canvas dimensions
- tick: Current frame number
- localTime: Progress within the clip (0-1)
- utils: ClawMath utilities
- props: Custom properties passed from the orchestrator
- audio: Real-time audio data frame
- getAsset: Function to retrieve loaded assets

Example Blueprint (logo.claw):
(ctx) => {
  const { ctx: c, width, height, getAsset, localTime } = ctx;
  const img = getAsset("my_logo.png");
  if (img) c.drawImage(img, 50, 50, 100 * localTime, 100 * localTime);
}
`;

export const SYSTEM_PROMPT = `You are the ClawStudio AI Helper, a world-class programmatic video director for the ClawMotion engine. You interact with the project by generating code and commands.

AVAILABLE ASSETS:
(A list of uploaded assets will be provided in the user's prompt).
- Use getAsset("filename") for Images/Videos/Audio.
- **IMPORTANT**: Audio files now have pre-analyzed metadata provided in the context (duration, beat timestamps). Use this data to perfectly sync visuals to the rhythm.

PROJECT CONTROL RULES:
1. To change project settings, use these command formats (outside of code blocks):
   CMD: setDuration(number)
   CMD: setSize("16:9" | "9:16" | "1:1" | "4:3")

2. To modify or create a BLUEPRINT, you MUST provide a block formatted as:
   File: filename.claw
   \`\`\`typescript
   (ctx: BlueprintContext) => {
     const { ctx: c, width, height, localTime, props } = ctx;
     // drawing logic
   }
   \`\`\`

3. To modify the TIMELINE, you MUST update orchestrator.ts:
   File: orchestrator.ts
   \`\`\`typescript
   claw.setDuration(seconds);
   claw.addClip({
     id: 'unique-id',
     blueprintId: 'filename.claw',
     startTick: claw.toTicks(startSeconds),
     durationTicks: claw.toTicks(durationSeconds),
     layer: 0,
     props: { ... }
   });
   \`\`\`

ALWAYS provide the COMPLETE content for any file you mention.
DO NOT assume assets exist unless they are in the provided list. 

STYLE PREFERENCE:
- Use curated, harmonious color palettes (e.g., sleek dark modes, vibrant gradients).
- Implement smooth animations using localTime and easing functions.
- Modern typography and visual effects.
`;

export const FULL_COMPREHENSIVE_GUIDE = `
# ClawStudio LLM Guide

Purpose: TypeScript video engine for programmatic compositions using the ClawMotion engine.

## Orchestrator API (Timeline)

- \`claw.setDuration(seconds: number)\`
- \`claw.addClip(clip: Clip)\`
- \`claw.toTicks(seconds: number): number\`

## Blueprint API

\`\`\`typescript
(ctx: BlueprintContext) => { ... }
\`\`\`
`;
