import { BlueprintContext } from './Context';
import { z } from 'zod';

export type BlueprintFn = (context: BlueprintContext) => void;

export interface SchemaBlueprint<T extends z.ZodTypeAny = z.ZodTypeAny> {
    id: string;
    description?: string;
    schema?: T;
    run: BlueprintFn;
}

export type Blueprint = BlueprintFn | SchemaBlueprint;

/**
 * Helper to define a strongly-typed, schema-validated Blueprint for AI Agents.
 */
export function defineBlueprint<T extends z.ZodTypeAny>(config: {
    id: string;
    description?: string;
    schema?: T;
    run: (context: Omit<BlueprintContext, 'props'> & { props: z.infer<T> }) => void;
}): SchemaBlueprint<T> {
    return {
        id: config.id,
        description: config.description,
        schema: config.schema,
        run: config.run as BlueprintFn,
    };
}

/**
 * The Registry stores all available Blueprints and exports schemas for LLMs.
 */
export class BlueprintRegistry {
    private entries: Map<string, SchemaBlueprint> = new Map();

    /**
     * Register a new Blueprint (function or schema blueprint).
     */
    public register(id: string, blueprint: Blueprint) {
        if (this.entries.has(id)) {
            console.warn(`Blueprint with ID ${id} is being overwritten.`);
        }

        if (typeof blueprint === 'function') {
            this.entries.set(id, { id, run: blueprint });
        } else {
            this.entries.set(id, blueprint);
        }
    }

    /**
     * Retrieve a Blueprint by ID.
     */
    public get(id: string): SchemaBlueprint | undefined {
        return this.entries.get(id);
    }

    /**
     * Check if a Blueprint exists.
     */
    public has(id: string): boolean {
        return this.entries.has(id);
    }

    /**
     * Export LLM-compatible tool definitions/schemas for all registered blueprints.
     */
    public exportSchemas(): Record<string, any> {
        const schemas: Record<string, any> = {};
        for (const [id, entry] of this.entries.entries()) {
            schemas[id] = {
                id: entry.id,
                description: entry.description || '',
                parameters: entry.schema ? this.zodToSimpleJsonSchema(entry.schema) : null,
            };
        }
        return schemas;
    }

    private zodToSimpleJsonSchema(schema: z.ZodTypeAny): any {
        if (schema instanceof z.ZodObject) {
            const shape = schema.shape;
            const properties: Record<string, any> = {};
            const required: string[] = [];

            for (const key of Object.keys(shape)) {
                const propSchema = (shape as any)[key];
                const typeName = propSchema._def.typeName ? propSchema._def.typeName.replace('Zod', '').toLowerCase() : 'string';

                properties[key] = {
                    type: typeName,
                    description: propSchema.description || '',
                    default: propSchema._def.defaultValue ? propSchema._def.defaultValue() : undefined
                };

                if (!propSchema.isOptional()) {
                    required.push(key);
                }
            }

            return {
                type: 'object',
                properties,
                required
            };
        }
        return { type: 'object', properties: {} };
    }
}
