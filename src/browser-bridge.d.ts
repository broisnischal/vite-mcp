import type { BrowserBridge } from "./bridge/index.js";

declare global {
    interface Window {
        __mcpBridge?: BrowserBridge;
    }
}

