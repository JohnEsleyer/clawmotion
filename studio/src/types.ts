export const typesVersion = "1.0";

export interface AudioAnalysisSettings {
    threshold: number;
    minInterval: number;
    offset: number;
}

export interface AudioSection {
    id: string;
    label: string;
    description?: string;
    start: number;
    end: number;
    color: string;
}

export interface AudioMetadata {
    duration: number;
    beats: number[];
    bpm?: number;
    summary: string;
    energies: number[]; // Raw energy profile for visualization/re-calculation
    settings: AudioAnalysisSettings;
    sections: AudioSection[];
}

export interface Asset {
    id: string;
    name: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    metadata?: AudioMetadata;
}

export interface FileEntry {
    id: string;
    name: string;
    code: string;
    type: 'clip' | 'orchestrator';
}

export interface Project {
    name: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    files: FileEntry[];
    assets: Asset[];
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}
