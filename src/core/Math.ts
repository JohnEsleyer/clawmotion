export interface SpringConfig {
    from?: number;      // Initial position (default 0)
    to?: number;        // Target position (default 1)
    time: number;       // Elapsed time in seconds (or localTime)
    stiffness?: number; // k (default 180)
    damping?: number;   // c (default 12)
    mass?: number;      // m (default 1)
    velocity?: number;  // Initial velocity (default 0)
}

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

    /**
     * Analytical Closed-Form Spring Solver
     * Computes exact spring displacement at any arbitrary time t without frame-stepping history.
     */
    public spring(config: SpringConfig): number {
        const from = config.from ?? 0;
        const to = config.to ?? 1;
        const t = config.time;
        if (t <= 0) return from;

        const k = config.stiffness ?? 180;
        const c = config.damping ?? 12;
        const m = config.mass ?? 1;
        const v0 = config.velocity ?? 0;

        const x0 = from - to;
        const w0 = Math.sqrt(k / m);
        const zeta = c / (2 * Math.sqrt(m * k));

        let x_t: number;

        if (zeta < 1) {
            const wd = w0 * Math.sqrt(1 - zeta * zeta);
            const A = x0;
            const B = (v0 + zeta * w0 * x0) / wd;
            const decay = Math.exp(-zeta * w0 * t);
            x_t = decay * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
        } else if (Math.abs(zeta - 1) < 1e-6) {
            const A = x0;
            const B = v0 + w0 * x0;
            const decay = Math.exp(-w0 * t);
            x_t = decay * (A + B * t);
        } else {
            const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
            const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
            const C2 = (v0 - r1 * x0) / (r2 - r1);
            const C1 = x0 - C2;
            x_t = C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
        }

        return to + x_t;
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
