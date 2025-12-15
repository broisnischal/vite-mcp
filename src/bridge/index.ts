import type { BrowserBridge } from "./core.js";

export { BrowserBridge } from "./core.js";
export type { AdapterBridge, AdapterBridgeRegistry, ToolCallMessage, ToolResultMessage } from "./types.js";
export * from "./adapters/index.js";

declare global {
    interface Window {
        __mcpBridge?: BrowserBridge;
    }
}

