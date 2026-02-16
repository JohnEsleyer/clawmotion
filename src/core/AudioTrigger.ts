import { Keyframe } from './Engine';
import { Easing } from './Math';

export interface AudioTriggerConfig {
    threshold: number;
    type: 'volume' | 'frequency';
    frequencyBin?: number;
    cooldownTicks: number; // Prevent multiple triggers in rapid succession
    reaction: {
        durationTicks: number;
        peakValue: any;
        baseValue: any;
        easing?: keyof typeof Easing;
    };
}

/**
 * Generates keyframe sequences based on audio peaks.
 */
export class AudioTrigger {
    /**
     * Scan audio data and return a list of keyframes for a specific property.
     */
    public static generateKeyframes(audioData: any[], config: AudioTriggerConfig): Keyframe[] {
        const keyframes: Keyframe[] = [];
        let lastTriggerTick = -config.cooldownTicks;

        for (let t = 0; t < audioData.length; t++) {
            const frame = audioData[t];
            let val = 0;

            if (config.type === 'volume') {
                val = frame.volume;
            } else if (config.type === 'frequency' && config.frequencyBin !== undefined) {
                val = frame.frequencies[config.frequencyBin] || 0;
            }

            // Check threshold and cooldown
            if (val >= config.threshold && (t - lastTriggerTick >= config.cooldownTicks)) {
                lastTriggerTick = t;

                // Add peak keyframe sequence
                // 1. Start from base
                keyframes.push({ tick: t, value: config.reaction.baseValue });

                // 2. Peak at mid-duration (or immediate)
                const midPoint = Math.floor(config.reaction.durationTicks * 0.2);
                keyframes.push({
                    tick: t + midPoint,
                    value: config.reaction.peakValue,
                    easing: config.reaction.easing || 'easeOutQuad'
                });

                // 3. Fall back to base
                keyframes.push({
                    tick: t + config.reaction.durationTicks,
                    value: config.reaction.baseValue,
                    easing: config.reaction.easing || 'easeInOutQuad'
                });
            }
        }

        // Sort and remove overlapping/redundant keyframes (simple pass)
        return keyframes.sort((a, b) => a.tick - b.tick);
    }
}
