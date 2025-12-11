import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

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

export const consoleAdapter: AdapterDefinition = {
  name: "read_console",
  description: "Read console messages from the browser",
  inputSchema: consoleAdapterInputSchema,
  outputSchema: consoleAdapterOutputSchema,
};
