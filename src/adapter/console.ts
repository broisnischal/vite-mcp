import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const consoleAdapterInputSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe("Maximum number of console messages to return"),
  type: z
    .enum(["log", "info", "warn", "error", "debug"])
    .optional()
    .describe("Filter console messages by type"),
});

export const consoleAdapterOutputSchema = z.object({
  messages: z
    .array(
      z.object({
        type: z.string().describe("Console message type"),
        message: z.string().describe("Console message content"),
        timestamp: z.number().optional().describe("Message timestamp"),
      })
    )
    .describe("Array of console messages"),
});

interface ConsoleMessage {
  type: string;
  message: string;
  timestamp?: number;
}

export const consoleAdapter: AdapterDefinition = {
  name: "read_console",
  description: "Read console messages from the browser",
  inputSchema: consoleAdapterInputSchema,
  outputSchema: consoleAdapterOutputSchema,
  handler: async function (params?: { limit?: number; type?: string }): Promise<CallToolResult> {
    if (typeof window === "undefined") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ messages: [] }),
          },
        ],
      };
    }

    try {
      const messages = ((window as any).__mcpConsoleMessages || []) as ConsoleMessage[];
      let filtered = [...messages];

      if (params?.type) {
        filtered = filtered.filter((msg: ConsoleMessage) => msg.type === params.type);
      }

      const limit = params?.limit !== undefined ? params.limit : 100;
      filtered = filtered.slice(-limit);

      const result = {
        messages: filtered.map((msg: ConsoleMessage) => ({
          type: msg.type,
          message: msg.message,
          timestamp: msg.timestamp || Date.now(),
        })),
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
            text: JSON.stringify({ messages: [] }),
          },
        ],
        isError: true,
      };
    }
  },
};
