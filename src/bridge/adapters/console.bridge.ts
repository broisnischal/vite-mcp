import type { AdapterBridge } from "../types.js";

interface ConsoleMessage {
    type: string;
    message: string;
    timestamp?: number;
}

export class ConsoleBridge implements AdapterBridge {
    async execute(params: { limit?: number; type?: string }): Promise<{ messages: Array<{ type: string; message: string; timestamp?: number }> }> {
        if (typeof window === "undefined") {
            return { messages: [] };
        }

        try {
            const messages = ((window as any).__mcpConsoleMessages || []) as ConsoleMessage[];
            let filtered = [...messages];

            if (params.type) {
                filtered = filtered.filter((msg: ConsoleMessage) => msg.type === params.type);
            }

            const limit = params.limit !== undefined ? params.limit : 100;
            filtered = filtered.slice(-limit);

            return {
                messages: filtered.map((msg: ConsoleMessage) => ({
                    type: msg.type,
                    message: msg.message,
                    timestamp: msg.timestamp || Date.now(),
                })),
            };
        } catch (error) {
            console.error("[MCP] Error reading console messages:", error);
            return { messages: [] };
        }
    }
}

