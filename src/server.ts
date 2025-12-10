import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { AdapterDefinition } from './adapter/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ViteMcpServerOptions {
    name: string;
    version: string;
    adapters: AdapterDefinition[];
}

export class ViteMcpServer {
    private mcpServer: McpServer;
    private adapterHandlers = new Map<string, (input: { [key: string]: unknown }) => Promise<CallToolResult>>();
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
        handler: (input: { [key: string]: unknown }) => Promise<CallToolResult>,
    ) {
        this.adapterHandlers.set(adapter.name, handler);

        // Use the high-level registerTool API from McpServer
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
            },
        );
    }

    async handleHTTP(req: IncomingMessage, res: ServerResponse): Promise<void> {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === 'GET') {
            // Return server info
            res.writeHead(200);
            res.end(
                JSON.stringify({
                    name: this.serverName,
                    version: this.serverVersion,
                }),
            );
            return;
        }

        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports.has(sessionId)) {
            // Reuse existing session
            transport = this.transports.get(sessionId)!;
        } else {
            // Create new transport for new session
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

            // Connect the MCP server to this transport
            await this.mcpServer.connect(transport);
        }

        // Handle the request
        let body = '';
        req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const message = body ? JSON.parse(body) : undefined;
                await transport.handleRequest(req, res, message);
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: String(error) }));
            }
        });

        req.on('error', (error) => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: String(error) }));
        });
    }

    getMcpServer(): McpServer {
        return this.mcpServer;
    }
}
