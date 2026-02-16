import { SYSTEM_PROMPT } from '../constants';
import type { FileEntry, Asset } from '../types';

export async function generateClawCode(
    prompt: string,
    files: FileEntry[],
    assets: Asset[],
    model: string = 'default'
): Promise<string> {
    const assetDescriptions = assets.map(a => {
        let desc = `- ${a.name} (${a.type})`;
        if (a.metadata) {
            desc += ` [METADATA: ${a.metadata.summary}]`;
        }
        return desc;
    }).join('\n');

    const context = `
Existing Files:
${files.map(f => `- ${f.name} (${f.type})`).join('\n')}

Available Assets:
${assetDescriptions || 'No assets uploaded'}

Current Orchestrator Code:
${files.find(f => f.type === 'orchestrator')?.code || ""}
`;

    console.log('AI Prompt:', `${SYSTEM_PROMPT}\n\nContext:\n${context}\n\nUser Request: ${prompt}`);

    return `// AI generation requires backend service
// For now, manually edit the code in the Editor tab

// To add a clip, use:
/*
claw.addClip({
  id: 'my-clip',
  blueprintId: 'background.claw',
  startTick: 0,
  durationTicks: 150,  // 5 seconds at 30fps
  layer: 0
});
*/`;
}

export function isAIAvailable(): boolean {
    return false;
}
