import type { AdapterBridge } from "../types.js";

export class ConsoleBridge implements AdapterBridge {
    async execute(params: { limit?: number; type?: string }): Promise<{ messages: Array<{ type: string; message: string; timestamp?: number }> }> {
        if (typeof window === "undefined") {
            return { messages: [] };
        }

        try {
            let component: HTMLElement & {
                getConsoleLogs(args: { limit?: number; type?: string }): Promise<{ messages: Array<{ type: string; message: string; timestamp: number }> }>;
            } | null = document.querySelector("read-console-element") as HTMLElement & {
                getConsoleLogs(args: { limit?: number; type?: string }): Promise<{ messages: Array<{ type: string; message: string; timestamp: number }> }>;
            };

            if (!component) {
                const wrapper = document.querySelector("mcp-adapter-read_console");
                if (wrapper) {
                    component = wrapper.querySelector("read-console-element") as HTMLElement & {
                        getConsoleLogs(args: { limit?: number; type?: string }): Promise<{ messages: Array<{ type: string; message: string; timestamp: number }> }>;
                    };
                }
            }

            if (!component && (window as any).__mcpConsoleInterceptor) {
                component = (window as any).__mcpConsoleInterceptor;
            }

            if (component && typeof component.getConsoleLogs === "function") {
                const result = await component.getConsoleLogs({
                    ...(params.limit !== undefined && { limit: params.limit }),
                    ...(params.type !== undefined && { type: params.type }),
                });
                return result;
            }

            return { messages: [] };
        } catch (error) {
            console.error("[MCP] Error reading console messages:", error);
            return { messages: [] };
        }
    }
}

