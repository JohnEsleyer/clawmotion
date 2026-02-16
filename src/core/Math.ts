
/**
 * Deterministic Math Library for ClawMotion
 * Ensures 100% reproducibility of animations regardless of environment.
 */

export class ClawMath {
    private seed: number;

    constructor(seed: number = 123456) {
        this.seed = seed;
    }

    /**
     * Linear Congruential Generator (LCG)
     * A simple, fast, and deterministic pseudo-random number generator.
     */
    public random(): number {
        const a = 1664525;
        const c = 1013904223;
        const m = 4294967296; // 2^32
        this.seed = (a * this.seed + c) % m;
        return this.seed / m;
    }

    /**
     * Returns a random number between min (inclusive) and max (exclusive).
     */
    public range(min: number, max: number): number {
        return min + this.random() * (max - min);
    }

    /**
     * Linear Interpolation
     */
    public static lerp(start: number, end: number, t: number): number {
        return start * (1 - t) + end * t;
    }

    /**
     * Clamps a value between min and max.
     */
    public static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    public easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}

/**
 * Standard Easing Functions
 * Input t is usually between 0 and 1.
 */
export const Easing = {
    linear: (t: number) => t,

    easeInQuad: (t: number) => t * t,
    easeOutQuad: (t: number) => t * (2 - t),
    easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

    easeInCubic: (t: number) => t * t * t,
    easeOutCubic: (t: number) => (--t) * t * t + 1,
    easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

    easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
    easeOutExpo: (t: number) => t === 1 ? 1 : -Math.pow(2, -10 * t) + 1,
};
