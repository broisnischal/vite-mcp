import type { AdapterBridge } from "../types.js";

type ConsoleLevel = "log" | "warn" | "error" | "info" | "debug";

interface ConsoleEntry {
    level: ConsoleLevel;
    args: unknown[];
    timestamp: number;
}

export class ConsoleBridge implements AdapterBridge {
    async execute(params: { tail?: number }): Promise<{ logs: Array<{ level: ConsoleLevel; args: unknown[]; timestamp: number }> }> {
        if (typeof window === "undefined") {
            return { logs: [] };
        }

        try {
            const entries = ((window as any).__mcpConsoleEntries || []) as ConsoleEntry[];
            let logs = [...entries];

            const tail = params.tail;
            if (tail !== undefined) {
                logs = logs.slice(-tail);
            }

            return {
                logs: logs.map((entry: ConsoleEntry) => ({
                    level: entry.level,
                    args: entry.args,
                    timestamp: entry.timestamp,
                })),
            };
        } catch (error) {
            console.error("[MCP] Error reading console messages:", error);
            return { logs: [] };
        }
    }
}

