import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type ConsoleLevel = "log" | "warn" | "error" | "info" | "debug";

interface ConsoleEntry {
  level: ConsoleLevel;
  args: unknown[];
  timestamp: number;
}

export const consoleAdapterInputSchema = z.object({
  tail: z
    .coerce
    .number()
    .min(1)
    .optional()
    .describe("Number (integer) of most recent console entries to return. If not specified, returns all entries."),
});

export const consoleAdapterOutputSchema = z.object({
  logs: z
    .array(
      z.object({
        level: z.enum(["log", "warn", "error", "info", "debug"]).describe("Console log level"),
        args: z.array(z.unknown()).describe("Console message arguments"),
        timestamp: z.number().describe("Message timestamp"),
      })
    )
    .describe("Array of console log entries"),
});

export const consoleAdapter: AdapterDefinition = {
  name: "read-console",
  description: "Read the console log",
  inputSchema: consoleAdapterInputSchema,
  outputSchema: consoleAdapterOutputSchema,
  handler: async function (params?: { tail?: number }): Promise<CallToolResult> {
    if (typeof window === "undefined") {
      return {
        structuredContent: { logs: [] },
        content: [
          {
            type: "text" as const,
            text: "No console logs found.",
          },
        ],
      };
    }

    try {
      const entries = ((window as any).__mcpConsoleEntries || []) as ConsoleEntry[];
      let logs = [...entries];

      const tail = params?.tail;
      if (tail !== undefined) {
        logs = logs.slice(-tail);
      }

      const formatConsoleEntry = (entry: ConsoleEntry): string => {
        const date = new Date(entry.timestamp);
        const timestamp = date.toLocaleString('sv-SE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        }).replace(',', '.');
        const argsString = entry.args
          .map(arg => {
            if (typeof arg === 'string') return arg;
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(' ');

        return `[${timestamp}] [${entry.level.toUpperCase()}] ${argsString}`;
      };

      const logText = logs.length > 0
        ? logs.map(formatConsoleEntry).join('\n')
        : 'No console logs found.';

      const structuredLogs = logs.map(entry => ({
        level: entry.level,
        args: entry.args,
        timestamp: entry.timestamp,
      }));

      return {
        structuredContent: { logs: structuredLogs },
        content: [
          {
            type: "text" as const,
            text: logText,
          },
        ],
      };
    } catch (error) {
      return {
        structuredContent: { logs: [] },
        content: [
          {
            type: "text" as const,
            text: `Error reading console logs: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
