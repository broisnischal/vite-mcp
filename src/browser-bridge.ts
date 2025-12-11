// Browser-side bridge that listens for tool calls from the MCP server
// via Vite's WebSocket and responds with results
// Browser-side bridge that listens for tool calls from the MCP server

/**
 * Bridge
 * @author: @broisnees
 * @description: BrowserBridge class that resolves for the adapters.
 */
class BrowserBridge {
  isReady = false;

  constructor() {
    this.setupViteWebSocket();
  }

  setupViteWebSocket() {
    if (
      typeof window === "undefined" ||
      typeof import.meta === "undefined" ||
      !import.meta.hot
    ) {
      return;
    }

    const hot = import.meta.hot;

    // @ts-ignore - Vite HMR custom events
    hot.on("mcp:tool-call", (data) => {
      if (data && typeof data === "object" && data.id && data.name) {
        this.handleToolCall(data);
      }
    });

    window.addEventListener("mcp:tool-result", (event) => {
      // @ts-ignore - Vite HMR custom events
      hot.send("mcp:tool-result", event.detail || {});
    });

    this.isReady = true;
    window.dispatchEvent(new CustomEvent("mcp:bridge-ready"));
  }

  // @ts-ignore
  async handleToolCall(message) {
    const { id, name, params } = message;
    let result;

    try {
      const data = await this.executeAdapter(name, params || {});
      // Return structured content that matches the output schema
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
        new CustomEvent("mcp:tool-result", {
          detail: { id, result },
        })
      );
    }
  }

  // @ts-ignore
  async executeAdapter(name, params = {}) {
    switch (name) {
      case "read_console": {
        // @ts-ignore
        let messages = [];

        // Try to access console messages if devtools-plugin is loaded
        // @ts-ignore
        if (typeof window.__studioConsoleMessages !== "undefined") {
          // @ts-ignore
          messages = [...window.__studioConsoleMessages];
          // @ts-ignore
        } else if (typeof window.__mcpConsoleMessages !== "undefined") {
          // Use our own console message storage
          // @ts-ignore
          messages = [...window.__mcpConsoleMessages];
        }

        // @ts-ignore
        const type = params.type;
        if (type) {
          // @ts-ignore
          messages = messages.filter((m) => m.type === type);
        }
        // @ts-ignore
        const limit = params.limit || 100;
        // @ts-ignore
        return { messages: messages.slice(-limit) };
      }

      case "read_local_storage": {
        return {
          items: Object.keys(localStorage).map((key) => ({
            key,
            value: localStorage.getItem(key) ?? "",
          })),
        };
      }

      case "read_session_storage": {
        return {
          items: Object.keys(sessionStorage).map((key) => ({
            key,
            value: sessionStorage.getItem(key) ?? "",
          })),
        };
      }

      case "read_cookies": {
        return {
          cookies: document.cookie
            .split(";")
            .map((cookie) => {
              const [name, ...valueParts] = cookie.trim().split("=");
              return {
                name: name?.trim() || "",
                value: valueParts.join("=").trim(),
              };
            })
            .filter((c) => c.name),
        };
      }

      default:
        throw new Error(`Unknown adapter: ${name}`);
    }
  }
}

if (typeof window !== "undefined") {
  try {
    // @ts-ignore
    window.__mcpBridge = new BrowserBridge();
  } catch (error) {
    console.error("[MCP Bridge] Failed to initialize bridge:", error);
  }
}

// Capture console messages
if (typeof window !== "undefined") {
  // @ts-ignore
  const consoleMessages = [];
  // @ts-ignore
  window.__mcpConsoleMessages = consoleMessages;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  // @ts-ignore
  const captureMessage = (type, ...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    consoleMessages.push({
      type,
      message,
      timestamp: Date.now(),
    });
    // Keep only last 1000 messages
    // @ts-ignore
    if (consoleMessages.length > 1000) {
      // @ts-ignore
      consoleMessages.shift();
    }
  };

  console.log = (...args) => {
    captureMessage("log", ...args);
    originalLog.apply(console, args);
  };

  console.info = (...args) => {
    captureMessage("info", ...args);
    originalInfo.apply(console, args);
  };

  console.warn = (...args) => {
    captureMessage("warn", ...args);
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    captureMessage("error", ...args);
    originalError.apply(console, args);
  };

  console.debug = (...args) => {
    captureMessage("debug", ...args);
    originalDebug.apply(console, args);
  };
}

export { BrowserBridge };
