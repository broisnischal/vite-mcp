import { z } from 'zod';
import type { AdapterDefinition } from './types.js';

export const localStorageAdapterInputSchema = z.object({});

export const localStorageAdapterOutputSchema = z.object({
    items: z.array(
        z.object({
            key: z.string().describe('Storage key'),
            value: z.string().describe('Storage value'),
        })
    ).describe('Array of localStorage items'),
});

export const localStorageAdapter: AdapterDefinition = {
    name: 'read_local_storage',
    description: 'Read localStorage items from the browser',
    inputSchema: localStorageAdapterInputSchema,
    outputSchema: localStorageAdapterOutputSchema,
};

