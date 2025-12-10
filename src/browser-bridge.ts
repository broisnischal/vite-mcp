// Browser-side bridge that listens for tool calls from the MCP server
// via Vite's WebSocket and responds with results

interface ToolCallMessage {
  id: string;
  name: string;
  params?: { [key: string]: unknown };
}

interface ToolResultMessage {
  id: string;
  result: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
}

class BrowserBridge {
  private isReady = false;

  constructor() {
    this.setupViteWebSocket();
  }

  private setupViteWebSocket() {
    if (typeof window === 'undefined') {
      return;
    }

    // Vite's WebSocket is available via import.meta.hot
    // We'll use a custom event system to communicate
    // The plugin will set up the WebSocket listener on the server side
    this.isReady = true;
    
    // Listen for custom events from the server
    window.addEventListener('mcp:tool-call', ((event: CustomEvent) => {
      this.handleToolCall(event.detail as ToolCallMessage);
    }) as EventListener);

    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('mcp:bridge-ready'));
    console.log('[MCP Bridge] Ready');
  }

  private async handleToolCall(message: ToolCallMessage) {
    const { id, name, params } = message;
    let result: ToolResultMessage['result'];

    try {
      const data = await this.executeAdapter(name, params || {});

      result = {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      result = {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }

    // Send result back via custom event
    if (this.isReady) {
      window.dispatchEvent(new CustomEvent('mcp:tool-result', {
        detail: { id, result },
      }));
    }
  }

  private async executeAdapter(name: string, params: { [key: string]: unknown }): Promise<unknown> {
    switch (name) {
      case 'read_console': {
        let messages: Array<{ type: string; message: string; timestamp?: number }> = [];

        // Try to access console messages if devtools-plugin is loaded
        if (typeof (window as any).__studioConsoleMessages !== 'undefined') {
          messages = [...(window as any).__studioConsoleMessages];
        }

        const type = params.type as string | undefined;
        if (type) {
          messages = messages.filter((m) => m.type === type);
        }
        const limit = (params.limit as number) || 100;
        return { messages: messages.slice(-limit) };
      }

      case 'read_local_storage': {
        return {
          items: Object.keys(localStorage).map((key) => ({
            key,
            value: localStorage.getItem(key) ?? '',
          })),
        };
      }

      case 'read_session_storage': {
        return {
          items: Object.keys(sessionStorage).map((key) => ({
            key,
            value: sessionStorage.getItem(key) ?? '',
          })),
        };
      }

      case 'read_cookies': {
        return {
          cookies: document.cookie.split(';').map((cookie) => {
            const [name, ...valueParts] = cookie.trim().split('=');
            return {
              name: name?.trim() || '',
              value: valueParts.join('=').trim(),
            };
          }).filter((c) => c.name),
        };
      }

      default:
        throw new Error(`Unknown adapter: ${name}`);
    }
  }
}

// Initialize the bridge when the script loads
if (typeof window !== 'undefined') {
  (window as any).__mcpBridge = new BrowserBridge();
}

export { BrowserBridge };
