import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { AdapterDefinition } from "./adapter/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

if (typeof z === "undefined") {
  throw new Error("zod is not available. Please ensure zod is installed.");
}

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
  private connectedTransports = new Set<string>();
  private serverName: string;
  private serverVersion: string;

  constructor(options: ViteMcpServerOptions) {
    this.serverName = options.name;
    this.serverVersion = options.version;

    if (typeof z === "undefined") {
      throw new Error("zod is not available. Please ensure zod is installed.");
    }

    this.mcpServer = new McpServer({
      name: options.name,
      version: options.version,
    });
  }


  // registerAdapter(
  //   adapter: AdapterDefinition,
  //   handler: (input: { [key: string]: unknown }) => Promise<CallToolResult>
  // ) {
  //   this.adapterHandlers.set(adapter.name, handler);

  //   if (!adapter.inputSchema) {
  //     throw new Error(`Adapter ${adapter.name} has no inputSchema`);
  //   }

  //   if (typeof z === "undefined") {
  //     throw new Error("zod is not available when registering adapter. Please ensure zod is installed.");
  //   }

  //   let inputJsonSchema: Record<string, unknown>;
  //   let outputJsonSchema: Record<string, unknown> | undefined;

  //   try {
  //     const converted = zodToJsonSchema(adapter.inputSchema, {
  //       unrepresentable: "any",
  //     });
  //     inputJsonSchema = this.ensurePlainObject(converted);
  //   } catch (error) {
  //     throw new Error(
  //       `Failed to convert input schema to JSON Schema for adapter ${adapter.name}: ${error instanceof Error ? error.message : String(error)
  //       }`
  //     );
  //   }

  //   if (adapter.outputSchema) {
  //     try {
  //       const converted = z.(adapter.outputSchema, {
  //         unrepresentable: "any",
  //       });
  //       outputJsonSchema = this.ensurePlainObject(converted);
  //     } catch (error) {
  //       throw new Error(
  //         `Failed to convert output schema to JSON Schema for adapter ${adapter.name}: ${error instanceof Error ? error.message : String(error)
  //         }`
  //       );
  //     }
  //   }

  //   const toolDefinition: {
  //     title: string;
  //     description: string;
  //     inputSchema: Record<string, unknown>;
  //     outputSchema?: Record<string, unknown>;
  //   } = {
  //     title: adapter.name,
  //     description: adapter.description,
  //     inputSchema: inputJsonSchema,
  //   };

  //   if (outputJsonSchema !== undefined) {
  //     toolDefinition.outputSchema = outputJsonSchema;
  //   }

  //   this.mcpServer.registerTool(
  //     adapter.name,
  //     toolDefinition as unknown as any,
  //     async (input: { [key: string]: unknown }) => {
  //       try {
  //         const validatedInput = adapter.inputSchema.parse(input) as { [key: string]: unknown };
  //         const handler = this.adapterHandlers.get(adapter.name);
  //         if (!handler) {
  //           throw new Error(`Adapter handler not found: ${adapter.name}`);
  //         }
  //         return await handler(validatedInput);
  //       } catch (error) {
  //         if (error instanceof z.ZodError) {
  //           const errorMessages = error.issues.map((issue) => {
  //             const path = issue.path.length > 0 ? issue.path.join(".") : "root";
  //             return `${path}: ${issue.message}`;
  //           });
  //           throw new Error(
  //             `Invalid input for adapter ${adapter.name}: ${errorMessages.join(", ")}`
  //           );
  //         }
  //         throw error;
  //       }
  //     }
  //   );
  // }
  registerAdapter(
    adapter: AdapterDefinition,
    handler: (input: { [key: string]: unknown }) => Promise<CallToolResult>
  ) {
    this.adapterHandlers.set(adapter.name, handler);

    if (!adapter.inputSchema) {
      throw new Error(`Adapter ${adapter.name} has no inputSchema`);
    }

    // Pass Zod schemas directly to MCP SDK
    // The SDK should handle them, even with Zod v4 compatibility issues
    const toolDefinition = {
      title: adapter.name,
      description: adapter.description,
      inputSchema: adapter.inputSchema,
      ...(adapter.outputSchema && { outputSchema: adapter.outputSchema }),
    };

    this.mcpServer.registerTool(
      adapter.name,
      toolDefinition as any,
      async (args: unknown) => {
        try {
          const input = args as { [key: string]: unknown };

          // Use safeParse to get detailed error information
          const parseResult = adapter.inputSchema.safeParse(input);
          if (!parseResult.success) {
            const errorMessages = parseResult.error.issues.map((issue) => {
              const path = issue.path.length > 0 ? issue.path.join(".") : "root";
              const code = (issue as any).code || "invalid_type";
              const received = (issue as any).received || typeof input;
              const expected = (issue as any).expected || "unknown";
              return `${path}: ${issue.message} (code: ${code}, received: ${received}, expected: ${expected})`;
            });
            throw new Error(
              `Invalid input for adapter ${adapter.name}: ${errorMessages.join(", ")}. Received input: ${JSON.stringify(input)}`
            );
          }

          const validatedInput = parseResult.data as { [key: string]: unknown };
          const handler = this.adapterHandlers.get(adapter.name);
          if (!handler) {
            throw new Error(`Adapter handler not found: ${adapter.name}`);
          }
          return await handler(validatedInput);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("Invalid input")) {
            throw error;
          }
          if (error instanceof z.ZodError) {
            const errorMessages = error.issues.map((issue) => {
              const path = issue.path.length > 0 ? issue.path.join(".") : "root";
              const code = (issue as any).code || "invalid_type";
              const received = (issue as any).received || "unknown";
              const expected = (issue as any).expected || "unknown";
              return `${path}: ${issue.message} (code: ${code}, received: ${received}, expected: ${expected})`;
            });
            throw new Error(
              `Invalid input for adapter ${adapter.name}: ${errorMessages.join(", ")}`
            );
          }
          throw error;
        }
      }
    );
  }


  async handleHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || "";
    const pathname = url.split("?")[0];
    const isSSEEndpoint = pathname === "/__mcp/sse" || pathname === "/__mcp/sse/";

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

      if (req.method === "GET" && !isSSEEndpoint) {
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
          res.writeHead(500, { "Content-Type": "application/json" });
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
    let isNewTransport = false;

    try {
      if (sessionId && this.transports.has(sessionId)) {
        transport = this.transports.get(sessionId)!;
      } else {
        isNewTransport = true;
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
              this.connectedTransports.delete(id);
            } catch (error) {
              console.error("[vite-mcp] Error closing session:", error);
            }
          },
        });

        transport.onclose = () => {
          try {
            if (transport.sessionId) {
              this.transports.delete(transport.sessionId);
              this.connectedTransports.delete(transport.sessionId);
            }
          } catch (error) {
            console.error("[vite-mcp] Error in transport onclose:", error);
          }
        };
      }
    } catch (error) {
      if (!res.headersSent) {
        try {
          res.writeHead(500, { "Content-Type": "application/json" });
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

    // Only connect if this is a new transport that hasn't been connected yet
    if (isNewTransport || (transport.sessionId && !this.connectedTransports.has(transport.sessionId))) {
      try {
        await this.mcpServer.connect(transport);
        if (transport.sessionId) {
          this.connectedTransports.add(transport.sessionId);
        }
      } catch (error) {
        // Check if error is due to transport already being connected
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("already started") || errorMessage.includes("already connected")) {
          // Transport is already connected, just mark it as connected
          if (transport.sessionId) {
            this.connectedTransports.add(transport.sessionId);
          }
        } else {
          // If connection fails for other reasons, clean up and return error
          try {
            if (transport.sessionId) {
              this.transports.delete(transport.sessionId);
              this.connectedTransports.delete(transport.sessionId);
            }
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                error: "Failed to initialize MCP connection",
                details: errorMessage
              }));
            }
          } catch (cleanupError) {
            console.error("[vite-mcp] Error during connection cleanup:", cleanupError);
          }
          return;
        }
      }
    }

    // Set Accept header based on endpoint type
    if (isSSEEndpoint) {
      // Force SSE mode for SSE endpoint
      req.headers.accept = "text/event-stream";
    } else if (!req.headers.accept) {
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
            res.writeHead(500, { "Content-Type": "application/json" });
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
          res.writeHead(500, { "Content-Type": "application/json" });
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
