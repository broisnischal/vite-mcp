import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const testSimpleAdapterInputSchema = z.object({
    message: z.string().describe("A simple message"),
    count: z.number().optional().describe("Optional count"),
});

export const testSimpleAdapterOutputSchema = z.object({
    success: z.boolean().describe("Whether the operation succeeded"),
    echo: z.string().describe("Echoed message"),
    timestamp: z.number().describe("Current timestamp"),
});

export const testSimpleAdapter: AdapterDefinition = {
    name: "test_simple",
    description: "A simple test adapter without unions or discriminated unions",
    inputSchema: testSimpleAdapterInputSchema,
    outputSchema: testSimpleAdapterOutputSchema,
    handler: async function (params?: {
        message?: string;
        count?: number;
    }): Promise<CallToolResult> {
        if (typeof window === "undefined") {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify({ error: "Not available in server environment" }),
                    },
                ],
                isError: true,
            };
        }

        try {
            const message = params?.message || "Hello from test adapter";
            const count = params?.count || 0;

            const result = {
                success: true,
                echo: `Echo: ${message} (count: ${count})`,
                timestamp: Date.now(),
            };

            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(result),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
                    },
                ],
                isError: true,
            };
        }
    },
};

