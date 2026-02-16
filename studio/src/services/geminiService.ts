import { SYSTEM_PROMPT } from '../constants';
import type { FileEntry, Asset } from '../types';

declare global {
    interface Window {
        puter?: {
            ai: {
                chat: (prompt: string, options: { model: string; stream?: boolean }) => Promise<any>;
            };
        };
    }
}

export const PUTER_MODELS = [
    'qwen/qwen3-next-80b-a3b-instruct',
    'qwen/qwen3-coder-next',
    'qwen/qwen3-max-thinking',
    'qwen/qwen3-vl-8b-instruct',
    'qwen/qwen3-coder',
    'qwen/qwen3-coder-plus',
    'qwen/qwen-plus-2025-07-28',
    'qwen/qwen3-30b-a3b-instruct-2507'
] as const;

export type PuterModel = (typeof PUTER_MODELS)[number];

export async function generateClawCode(
    prompt: string,
    files: FileEntry[],
    assets: Asset[],
    model: PuterModel = 'qwen/qwen3-next-80b-a3b-instruct'
): Promise<string> {
    if (!window.puter?.ai?.chat) {
        throw new Error('Puter.js is not available. Reload the page and sign in to Puter if prompted.');
    }

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
${files.find(f => f.type === 'orchestrator')?.code || ''}
`;

    const response = await window.puter.ai.chat(
        `${SYSTEM_PROMPT}\n\nContext:\n${context}\n\nUser Request: ${prompt}`,
        { model }
    );

    if (typeof response === 'string') return response;
    if (response?.text) return response.text;
    return JSON.stringify(response, null, 2);
}

export function isAIAvailable(): boolean {
    return Boolean(window.puter?.ai?.chat);
}
