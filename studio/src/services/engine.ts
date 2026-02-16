
import type { AudioMetadata, AudioAnalysisSettings, AudioSection } from "../types";
import { ClawEngine } from "@core/Engine";
import type { Clip, ClawConfig } from "@core/Engine";
import { ClawPlayer } from "@client/Player";

export type { Clip, ClawConfig };
export { ClawEngine };
export { ClawPlayer };

export interface ScheduledClip {
    filename: string;
    start: number;
    duration: number;
}

export interface ScheduledAudio {
    filename: string;
    start: number;
    duration: number;
}

/**
 * ClawEngine Wrapper for Studio - Adapts base engine for UI needs
 */

export interface AudioAnalysis {
    volume: number;
    bands: [number, number, number, number];
    beat: boolean;
    fft: Uint8Array;
    energy: number;
}

/**
 * Re-runs beat detection on existing energy data with new settings
 */
export function detectBeats(
    energies: number[],
    settings: AudioAnalysisSettings,
    windowSizeSeconds: number = 0.05
): number[] {
    const beats: number[] = [];
    const historySize = 43;

    for (let i = 0; i < energies.length; i++) {
        const start = Math.max(0, i - historySize);
        const end = Math.min(energies.length, i + historySize);
        let avgSum = 0;
        for (let j = start; j < end; j++) avgSum += energies[j];
        const localAvg = avgSum / (end - start || 1);

        if (energies[i] > localAvg * settings.threshold && energies[i] > 0.1) {
            const time = i * windowSizeSeconds + settings.offset;
            if (beats.length === 0 || time - beats[beats.length - 1] > settings.minInterval) {
                if (time >= 0) beats.push(parseFloat(time.toFixed(3)));
            }
        }
    }
    return beats;
}

export function generateAudioSummary(duration: number, beats: number[], sections: AudioSection[] = []): string {
    let summary = `Duration: ${duration.toFixed(2)}s. `;

    if (sections.length > 0) {
        summary += `Segments: ${sections.map(s => {
            let desc = `"${s.label}"`;
            if (s.description) desc += ` (${s.description})`;
            desc += ` [${s.start.toFixed(1)}s-${s.end.toFixed(1)}s]`;
            return desc;
        }).join(', ')}. `;
    }

    if (beats.length > 0) {
        summary += `Detected ${beats.length} beats. `;
        const previewBeats = beats.slice(0, 5).join(', ');
        summary += `Starts at: [${previewBeats}${beats.length > 5 ? '...' : ''}].`;
    } else {
        summary += "No clear beats detected.";
    }
    return summary;
}

export async function analyzeAudioFile(file: File): Promise<AudioMetadata> {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer);

    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    const windowSize = Math.floor(sampleRate * 0.05);
    const energies: number[] = [];

    for (let i = 0; i < data.length; i += windowSize) {
        let sum = 0;
        let count = 0;
        for (let j = 0; j < windowSize && i + j < data.length; j++) {
            sum += data[i + j] * data[i + j];
            count++;
        }
        energies.push(Math.sqrt(sum / count));
    }

    const defaultSettings: AudioAnalysisSettings = {
        threshold: 1.3,
        minInterval: 0.25,
        offset: 0
    };

    const beats = detectBeats(energies, defaultSettings);
    const summary = generateAudioSummary(duration, beats, []);

    return {
        duration,
        beats,
        summary,
        energies,
        settings: defaultSettings,
        sections: []
    };
}

export class StudioEngine {
    public engine: ClawEngine;
    private player: ClawPlayer | null = null;
    private durationSeconds: number;

    constructor(config: ClawConfig, canvasContainer: HTMLElement) {
        this.engine = new ClawEngine(config);
        this.durationSeconds = config.duration;
        this.player = new ClawPlayer(canvasContainer, this.engine);
    }

    public registerBlueprint(id: string, drawFn: any) {
        this.engine.registry.register(id, drawFn);
    }

    public addClip(clip: Clip) {
        this.engine.addClip(clip);
    }

    public setDuration(seconds: number) {
        this.engine.config.duration = seconds;
        this.durationSeconds = seconds;
    }

    public toTicks(seconds: number) {
        return this.engine.toTicks(seconds);
    }

    public resetTimeline() {
        this.engine.clips = [];
    }

    public async play() {
        if (this.player) this.player.play();
    }

    public pause() {
        if (this.player) this.player.pause();
    }

    public async seek(seconds: number) {
        if (this.player) await this.player.seekToTime(seconds);
    }

    public getCurrentTime() {
        if (!this.player) return 0;
        // @ts-ignore - accessing private field for Studio needs
        return this.player.currentTick / this.engine.config.fps;
    }

    public getEngine() { return this.engine; }
    public getPlayer() { return this.player; }

    public getState() {
        return {
            clips: this.engine.clips,
            duration: this.durationSeconds
        };
    }
}
