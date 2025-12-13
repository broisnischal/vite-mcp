import type { AdapterBridge, AdapterBridgeRegistry, ToolCallMessage, ToolResultMessage } from "./types.js";
import {
  ConsoleBridge,
  CookieBridge,
  LocalStorageBridge,
  SessionStorageBridge,
  CacheBridge,
  IndexedDBBridge,
  PerformanceBridge,
  // ComponentRoutesBridge,
} from "./adapters/index.js";

export class BrowserBridge {
  private isReady = false;
  private adapters: AdapterBridgeRegistry = new Map();

  constructor() {
    this.registerDefaultAdapters();
    this.setupViteWebSocket();
  }

  private registerDefaultAdapters(): void {
    this.adapters.set("read-console", new ConsoleBridge());
    this.adapters.set("cookie", new CookieBridge());
    this.adapters.set("local_storage", new LocalStorageBridge());
    this.adapters.set("session_storage", new SessionStorageBridge());
    this.adapters.set("cache", new CacheBridge());
    this.adapters.set("indexed_db", new IndexedDBBridge());
    this.adapters.set("performance", new PerformanceBridge());
    // this.adapters.set("read_component_routes", new ComponentRoutesBridge());
  }

  registerAdapter(name: string, bridge: AdapterBridge): void {
    this.adapters.set(name, bridge);
  }

  private setupViteWebSocket(): void {
    if (
      typeof window === "undefined" ||
      typeof import.meta === "undefined" ||
      !import.meta.hot
    ) {
      return;
    }

    const hot = import.meta.hot;
    if (hot) {
      // Use type assertion for custom HMR events
      (hot as any).on("mcp:tool-call", (data: ToolCallMessage) => {
        if (data && typeof data === "object" && data.id && data.name) {
          this.handleToolCall(data);
        }
      });

      window.addEventListener("mcp:tool-result", ((event: CustomEvent<ToolResultMessage>) => {
        if (hot && "send" in hot && typeof hot.send === "function") {
          (hot as any).send("mcp:tool-result", event.detail || {});
        }
      }) as EventListener);
    }

    this.isReady = true;
    window.dispatchEvent(new CustomEvent("mcp:bridge-ready"));
  }

  private async handleToolCall(message: ToolCallMessage): Promise<void> {
    const { id, name, params } = message;
    let result: ToolResultMessage["result"];

    try {
      const adapter = this.adapters.get(name);
      if (!adapter) {
        throw new Error(`Unknown adapter: ${name}`);
      }

      const data = await adapter.execute(params || {});
      result = {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
      };
    } catch (error) {
      result = {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }

    if (this.isReady) {
      window.dispatchEvent(
        new CustomEvent<ToolResultMessage>("mcp:tool-result", {
          detail: { id, result },
        })
      );
    }
  }
}

