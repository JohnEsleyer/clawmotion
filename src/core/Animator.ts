import { Keyframe } from './Engine';
import { Easing } from './Math';

/**
 * Handles interpolation between keyframes.
 */
export class ClawAnimator {
    /**
     * Resolve the value of a property at a specific tick.
     */
    public static resolve(keyframes: Keyframe[], tick: number): any {
        if (!keyframes || keyframes.length === 0) return undefined;

        // Sort keyframes by tick if not already
        const sorted = [...keyframes].sort((a, b) => a.tick - b.tick);

        // 1. Check if tick is before first keyframe
        if (tick <= sorted[0].tick) return sorted[0].value;

        // 2. Check if tick is after last keyframe
        if (tick >= sorted[sorted.length - 1].tick) return sorted[sorted.length - 1].value;

        // 3. Find the two keyframes to interpolate between
        for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            if (tick >= current.tick && tick < next.tick) {
                const range = next.tick - current.tick;
                const progress = (tick - current.tick) / range;

                // Apply easing if provided
                const easingFunc = next.easing ? Easing[next.easing] : Easing.linear;
                const easedProgress = easingFunc(progress);

                return this.interpolate(current.value, next.value, easedProgress);
            }
        }

        return sorted[0].value;
    }

    private static interpolate(a: any, b: any, t: number): any {
        if (typeof a === 'number' && typeof b === 'number') {
            return a + (b - a) * t;
        }

        // For non-numeric values, we just step-tween at t=1 (or t=0.5)
        return t < 1 ? a : b;
    }
}
