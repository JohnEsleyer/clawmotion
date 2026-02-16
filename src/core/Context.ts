import { ClawMath } from './Math';

/**
 * The Global Context available to the Engine.
 */
export interface GlobalContext {
    width: number;
    height: number;
    fps: number;
    tick: number;     // Current frame number
    time: number;     // Current time in seconds
    duration: number; // Total duration in seconds
    debug: boolean;
}

/**
 * The Local Context passed to a Blueprint during execution.
 * It combines the specific drawing context with timing metrics.
 */
export interface BlueprintContext {
    /**
     * The drawing context (Canvas2D or WebGL).
     * For now, typed as any to support both, but primarily CanvasRenderingContext2D.
     */
    ctx: any;

    /**
     * 0.0 at the start of the clip, 1.0 at the end.
     */
    localTime: number;

    /**
     * The global frame number.
     */
    tick: number;

    /**
     * Width of the canvas.
     */
    width: number;

    /**
     * Height of the canvas.
     */
    height: number;

    /**
   * Access to the deterministic math library.
   */
    utils: ClawMath;

    /**
     * Pre-baked audio data for the current frame.
     * Only populated if an audio track is present.
     */
    audio?: {
        volume: number;
        frequencies: number[];
    };

    /**
   * Custom properties passed to the clip.
   */
    props: Record<string, any>;

    /**
     * Access to loaded assets.
     */
    getAsset: (id: string) => any;
}
