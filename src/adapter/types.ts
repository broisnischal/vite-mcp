import type { z } from 'zod';

export interface AdapterDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    outputSchema?: z.ZodSchema;
    component?: () => HTMLElement | Promise<HTMLElement>;
}

