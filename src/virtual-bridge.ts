// Virtual module for MCP Bridge
// This can be imported in the app to access the bridge

import type { BrowserBridge } from "./browser-bridge.js";
export { BrowserBridge } from "./browser-bridge.js";

// Re-export for convenience
export function getMcpBridge(): BrowserBridge | undefined {
  if (typeof window !== "undefined") {
    return (window as any).__mcpBridge;
  }
  return undefined;
}
