import { BrowserBridge } from "./bridge/index.js";

if (typeof window !== "undefined") {
  const mode = import.meta.env && import.meta.env["MODE"];
  if (mode === "development") {
    try {
      window.__mcpBridge = new BrowserBridge();
    } catch (error) {
      console.error("[MCP Bridge] Failed to initialize bridge:", error);
    }
  }
}

export { BrowserBridge };
