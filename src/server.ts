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
        const handler = this.adapterHandlers.get(adapter.name);
        if (!handler) {
          throw new Error(`Adapter handler not found: ${adapter.name}`);
        }
        return await handler(input);
      }
    );
  }

  async handleHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, mcp-session-id, Last-Event-ID, Authorization"
    );
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          name: this.serverName,
          version: this.serverVersion,
          adapters: Array.from(this.adapterHandlers.keys()),
        })
      );
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && this.transports.has(sessionId)) {
      transport = this.transports.get(sessionId)!;
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          this.transports.set(id, transport);
        },
        onsessionclosed: (id) => {
          this.transports.delete(id);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          this.transports.delete(transport.sessionId);
        }
      };

      await this.mcpServer.connect(transport);
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
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const message = body ? JSON.parse(body) : undefined;
        await transport.handleRequest(req, res, message);
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(error) }));
        }
      }
    });

    req.on("error", (error) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(error) }));
    });
  }

  getMcpServer(): McpServer {
    return this.mcpServer;
  }
}
