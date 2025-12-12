import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { AdapterDefinition } from "./adapter/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface ViteMcpServerOptions {
  name: string;
  version: string;
  adapters: AdapterDefinition[];
}

export class ViteMcpServer {
  private mcpServer: McpServer;
  private adapterHandlers = new Map<
    string,
    (input: { [key: string]: unknown }) => Promise<CallToolResult>
  >();
  private transports = new Map<string, StreamableHTTPServerTransport>();
  private serverName: string;
  private serverVersion: string;

  constructor(options: ViteMcpServerOptions) {
    this.serverName = options.name;
    this.serverVersion = options.version;
    this.mcpServer = new McpServer({
      name: options.name,
      version: options.version,
    });
  }

  registerAdapter(
    adapter: AdapterDefinition,
    handler: (input: { [key: string]: unknown }) => Promise<CallToolResult>
  ) {
    try {
      this.adapterHandlers.set(adapter.name, handler);

      // The API accepts Zod schemas directly
      this.mcpServer.registerTool(
        adapter.name,
        {
          title: adapter.name,
          description: adapter.description,
          inputSchema: adapter.inputSchema as any,
          outputSchema: adapter.outputSchema as any,
        },
        async (input: { [key: string]: unknown }) => {
          try {
            const handler = this.adapterHandlers.get(adapter.name);
            if (!handler) {
              throw new Error(`Adapter handler not found: ${adapter.name}`);
            }
            return await handler(input);
          } catch (error) {
            // Re-throw the error to let the MCP SDK handle it
            throw error;
          }
        }
      );
    } catch (error) {
      console.error(`[vite-mcp] Error registering adapter ${adapter.name}:`, error);
      throw error;
    }
  }

  async handleHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Accept, mcp-session-id, Last-Event-ID, Authorization"
      );
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      if (req.method === "OPTIONS") {
        try {
          res.writeHead(200);
          res.end();
        } catch (error) {
          console.error("[vite-mcp] Error handling OPTIONS request:", error);
        }
        return;
      }

      if (req.method === "GET") {
        try {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(
            JSON.stringify({
              name: this.serverName,
              version: this.serverVersion,
              adapters: Array.from(this.adapterHandlers.keys()),
            })
          );
        } catch (error) {
          console.error("[vite-mcp] Error handling GET request:", error);
        }
        return;
      }
    } catch (error) {
      console.error("[vite-mcp] Error in handleHTTP setup:", error);
      if (!res.headersSent) {
        try {
          res.writeHead(500);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: "Internal server error",
            details: error instanceof Error ? error.message : String(error)
          }));
        } catch (writeError) {
          console.error("[vite-mcp] Failed to send error response:", writeError);
        }
      }
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    try {
      if (sessionId && this.transports.has(sessionId)) {
        transport = this.transports.get(sessionId)!;
      } else {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (id) => {
            try {
              this.transports.set(id, transport);
            } catch (error) {
              console.error("[vite-mcp] Error initializing session:", error);
            }
          },
          onsessionclosed: (id) => {
            try {
              this.transports.delete(id);
            } catch (error) {
              console.error("[vite-mcp] Error closing session:", error);
            }
          },
        });

        transport.onclose = () => {
          try {
            if (transport.sessionId) {
              this.transports.delete(transport.sessionId);
            }
          } catch (error) {
            console.error("[vite-mcp] Error in transport onclose:", error);
          }
        };
      }
    } catch (error) {
      if (!res.headersSent) {
        try {
          res.writeHead(500);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: "Failed to create transport",
            details: error instanceof Error ? error.message : String(error)
          }));
        } catch (writeError) {
          console.error("[vite-mcp] Failed to send error response:", writeError);
        }
      }
      return;
    }

    // Connect the server to the transport
    // This initializes the MCP protocol handshake
    // Note: This is a necessary step and may take some time on first connection
    try {
      await this.mcpServer.connect(transport);
    } catch (error) {
      // If connection fails, clean up and return error
      try {
        if (transport.sessionId) {
          this.transports.delete(transport.sessionId);
        }
        if (!res.headersSent) {
          res.writeHead(500);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: "Failed to initialize MCP connection",
            details: error instanceof Error ? error.message : String(error)
          }));
        }
      } catch (cleanupError) {
        console.error("[vite-mcp] Error during connection cleanup:", cleanupError);
      }
      return;
    }

    if (!req.headers.accept) {
      req.headers.accept = "application/json, text/event-stream";
    } else if (
      !req.headers.accept.includes("application/json") ||
      !req.headers.accept.includes("text/event-stream")
    ) {
      const accept = req.headers.accept;
      let newAccept = accept;
      if (!accept.includes("application/json")) {
        newAccept += ", application/json";
      }
      if (!accept.includes("text/event-stream")) {
        newAccept += ", text/event-stream";
      }
      req.headers.accept = newAccept;
    }

    let body = "";
    req.on("data", (chunk: Buffer) => {
      try {
        body += chunk.toString();
      } catch (error) {
        console.error("[vite-mcp] Error reading request data:", error);
      }
    });

    req.on("end", async () => {
      try {
        const message = body ? JSON.parse(body) : undefined;
        await transport.handleRequest(req, res, message);
      } catch (error) {
        if (!res.headersSent) {
          try {
            res.writeHead(500);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              error: "Request processing failed",
              details: error instanceof Error ? error.message : String(error)
            }));
          } catch (writeError) {
            // If we can't write the error response, just log it
            console.error("[vite-mcp] Failed to send error response:", writeError);
          }
        }
      }
    });

    req.on("error", (error) => {
      try {
        if (!res.headersSent) {
          res.writeHead(500);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error: "Request error",
            details: error instanceof Error ? error.message : String(error)
          }));
        }
      } catch (writeError) {
        console.error("[vite-mcp] Failed to send error response:", writeError);
      }
    });
  }

  getMcpServer(): McpServer {
    return this.mcpServer;
  }
}
