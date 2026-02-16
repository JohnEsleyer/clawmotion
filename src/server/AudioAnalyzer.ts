import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import wav from 'node-wav';
// @ts-ignore
import { fft, util as fftUtil } from 'fft-js';

export interface AudioFrameData {
    volume: number;
    frequencies: number[];
}

export interface AudioAnalysis {
    frames: AudioFrameData[];
    sampleRate: number;
    fps: number;
}

export class AudioAnalyzer {
    /**
     * Analyze an audio file and return a frame-by-frame data map.
     */
    public async analyze(audioPath: string, fps: number, bins: number = 16): Promise<AudioAnalysis> {
        const tempWav = path.join(process.cwd(), `temp_${Date.now()}.wav`);

        // 1. Convert to Mono WAV 44.1kHz for consistent analysis
        await new Promise<void>((resolve, reject) => {
            ffmpeg(audioPath)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(44100)
                .on('error', reject)
                .on('end', () => resolve())
                .save(tempWav);
        });

        // 2. Read WAV file
        const buffer = fs.readFileSync(tempWav);
        const result = wav.decode(buffer);
        const channelData = result.channelData[0]; // Mono
        const sampleRate = result.sampleRate;

        // 3. Cleanup temp file
        fs.unlinkSync(tempWav);

        const samplesPerFrame = sampleRate / fps;
        const totalFrames = Math.floor(channelData.length / samplesPerFrame);
        const frames: AudioFrameData[] = [];

        console.log(`[AudioAnalyzer] Analyzing ${totalFrames} frames at ${fps}fps...`);

        for (let i = 0; i < totalFrames; i++) {
            const start = Math.floor(i * samplesPerFrame);
            const end = Math.floor(start + samplesPerFrame);
            const frameSamples = channelData.slice(start, end);

            // a. Calculate RMS Volume
            let sumSquared = 0;
            for (let s = 0; s < frameSamples.length; s++) {
                sumSquared += frameSamples[s] * frameSamples[s];
            }
            const rms = Math.sqrt(sumSquared / frameSamples.length);

            // b. Calculate FFT for frequencies
            // We need a power-of-two size for fft-js. 
            // Let's take the closest power of two to our samplesPerFrame.
            const fftSize = Math.pow(2, Math.round(Math.log2(frameSamples.length)));
            const paddedSamples = new Float32Array(fftSize);
            paddedSamples.set(frameSamples.slice(0, fftSize));

            const phasors = fft(paddedSamples);
            const magnitudes = fftUtil.fftMag(phasors);

            // c. Bin the frequencies down to the requested number
            const binSize = Math.floor(magnitudes.length / bins);
            const binnedFrequencies: number[] = [];
            for (let b = 0; b < bins; b++) {
                let binSum = 0;
                for (let j = 0; j < binSize; j++) {
                    binSum += magnitudes[b * binSize + j] || 0;
                }
                binnedFrequencies.push(binSum / binSize);
            }

            frames.push({
                volume: rms,
                frequencies: binnedFrequencies
            });
        }

        return {
            frames,
            sampleRate,
            fps
        };
    }
}
