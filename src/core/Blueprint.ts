import { BlueprintContext } from './Context';

/**
 * A Blueprint is a pure function that renders a frame.
 * It takes a context and returns nothing (side effects on ctx).
 */
export type Blueprint = (context: BlueprintContext) => void;

/**
 * The Registry stores all available Blueprints.
 */
export class BlueprintRegistry {
    private benchmarks: Map<string, Blueprint> = new Map();

    /**
     * Register a new Blueprint.
     * @param id Unique identifier for the blueprint
     * @param blueprint The function logic
     */
    public register(id: string, blueprint: Blueprint) {
        if (this.benchmarks.has(id)) {
            console.warn(`Blueprint with ID ${id} is being overwritten.`);
        }
        this.benchmarks.set(id, blueprint);
    }

    /**
     * Retrieve a Blueprint by ID.
     */
    public get(id: string): Blueprint | undefined {
        return this.benchmarks.get(id);
    }

    /**
     * Check if a Blueprint exists.
     */
    public has(id: string): boolean {
        return this.benchmarks.has(id);
    }
}
