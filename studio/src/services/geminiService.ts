import { SYSTEM_PROMPT } from '../constants';
import type { Asset, FileEntry, LLMConfig, LLMProvider } from '../types';

declare global {
    interface Window {
        puter?: {
            ai: {
                chat: (prompt: string, options: { model: string; stream?: boolean }) => Promise<any>;
            };
        };
    }
}

export const PROVIDER_MODELS: Record<LLMProvider, readonly string[]> = {
    puter: [
        'qwen/qwen3-next-80b-a3b-instruct',
        'qwen/qwen3-coder-next',
        'qwen/qwen3-max-thinking',
        'qwen/qwen3-vl-8b-instruct',
        'qwen/qwen3-coder',
        'qwen/qwen3-coder-plus',
        'qwen/qwen-plus-2025-07-28',
        'qwen/qwen3-30b-a3b-instruct-2507'
    ],
    openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'],
    anthropic: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest'],
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro']
} as const;

export const DEFAULT_LLM_CONFIG: LLMConfig = {
    provider: 'puter',
    model: PROVIDER_MODELS.puter[0]
};

function buildAssistantContext(prompt: string, files: FileEntry[], assets: Asset[]): string {
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

    return `${SYSTEM_PROMPT}\n\nContext:\n${context}\n\nUser Request: ${prompt}`;
}

async function queryPuter(input: string, model: string): Promise<string> {
    if (!window.puter?.ai?.chat) {
        throw new Error('Puter.js is not available. Reload the page and sign in to Puter if prompted.');
    }
    const response = await window.puter.ai.chat(input, { model });
    if (typeof response === 'string') return response;
    if (response?.text) return response.text;
    return JSON.stringify(response, null, 2);
}

async function queryOpenAI(input: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: input }],
            temperature: 0.5
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI request failed (${response.status})`);
    }

    const json = await response.json();
    return json?.choices?.[0]?.message?.content || 'No response content.';
}

async function queryAnthropic(input: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model,
            max_tokens: 1800,
            messages: [{ role: 'user', content: input }]
        })
    });

    if (!response.ok) {
        throw new Error(`Anthropic request failed (${response.status})`);
    }

    const json = await response.json();
    return json?.content?.map((part: any) => part?.text || '').join('\n').trim() || 'No response content.';
}

async function queryGemini(input: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: input }] }]
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini request failed (${response.status})`);
    }

    const json = await response.json();
    return json?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n').trim() || 'No response content.';
}

function assertApiKey(config: LLMConfig) {
    if (config.provider === 'puter') return;
    if (!config.apiKey?.trim()) {
        throw new Error(`Missing API key for ${config.provider}. Add it in the provider settings.`);
    }
}

export async function generateClawCode(
    prompt: string,
    files: FileEntry[],
    assets: Asset[],
    config: LLMConfig
): Promise<string> {
    const input = buildAssistantContext(prompt, files, assets);
    assertApiKey(config);

    if (config.provider === 'puter') {
        return queryPuter(input, config.model);
    }

    if (config.provider === 'openai') {
        return queryOpenAI(input, config.model, config.apiKey!.trim());
    }

    if (config.provider === 'anthropic') {
        return queryAnthropic(input, config.model, config.apiKey!.trim());
    }

    return queryGemini(input, config.model, config.apiKey!.trim());
}

export function isAIAvailable(config: LLMConfig): boolean {
    if (config.provider === 'puter') {
        return Boolean(window.puter?.ai?.chat);
    }
    return Boolean(config.apiKey?.trim());
}
