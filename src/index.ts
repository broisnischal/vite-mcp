import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ViteMcpServer } from './server.js';
import {
    consoleAdapter,
    cookieAdapter,
    localStorageAdapter,
    sessionAdapter,
} from './adapter/index.js';
import type { AdapterDefinition } from './adapter/types.js';
import { Deferred } from './utils.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = __dirname;

const BRIDGE_PATH = '/@vite-mcp/bridge.js';
const RESOLVED_BRIDGE_ID = '\0vite-mcp-bridge';
const MCP_PATH = '/__mcp';

export interface ViteMcpOptions {
    adapters?: AdapterDefinition[];
}

function log(message: string) {
    console.log(`[vite-mcp] ${message}`);
}

function registerAndAppendWebComponent(name: string, component: () => HTMLElement | Promise<HTMLElement>) {
    if (typeof window === 'undefined') return;

    customElements.define(`mcp-adapter-${name}`, class extends HTMLElement {
        connectedCallback() {
            Promise.resolve(component()).then((el) => {
                this.appendChild(el);
            });
        }
    });
}

export function viteMcp(options: ViteMcpOptions = {}): Plugin {
    const adapters = options.adapters || [
        consoleAdapter,
        localStorageAdapter,
        cookieAdapter,
        sessionAdapter,
    ];

    let viteServer: ViteDevServer | null = null;
    const pendingToolCalls = new Map<string, Deferred<CallToolResult>>();

    async function dispatchToolCall(
        name: string,
        params: { [key: string]: unknown },
    ): Promise<CallToolResult> {
        const id = `${Date.now()}${Math.random()}`;
        const deferred = new Deferred<CallToolResult>();
        pendingToolCalls.set(id, deferred);

        // Add timeout (30 seconds)
        const timeout = setTimeout(() => {
            const pending = pendingToolCalls.get(id);
            if (pending) {
                pendingToolCalls.delete(id);
                pending.reject(new Error('Tool call timeout: Browser bridge may not be ready. Make sure the browser page is open at http://localhost:5200'));
            }
        }, 30000);

        // Clear timeout when resolved
        deferred.promise.finally(() => clearTimeout(timeout));

        if (viteServer?.ws) {
            const clientCount = viteServer.ws.clients.size;

            if (clientCount === 0) {
                deferred.reject(new Error('No WebSocket clients connected. Make sure the browser page is open at http://localhost:5200'));
                return deferred.promise;
            }

            try {
                const payload = { id, name, params: params || {} };
                (viteServer.ws as any).send('mcp:tool-call', payload);
            } catch (error) {
                deferred.reject(error instanceof Error ? error : new Error(String(error)));
            }
        } else {
            deferred.reject(new Error('Vite WebSocket server is not available. Make sure the dev server is running.'));
        }

        return deferred.promise;
    }

    const createMcpServer = () => {
        const server = new ViteMcpServer({
            name: 'vite-mcp',
            version: '0.0.1',
            adapters,
        });

        for (const adapter of adapters) {
            server.registerAdapter(
                adapter,
                async (input: { [key: string]: unknown }) => {
                    try {
                        const validatedInput = adapter.inputSchema.parse(input) as { [key: string]: unknown };
                        const result = await dispatchToolCall(adapter.name, validatedInput);

                        if (result.content && result.content.length > 0 && result.content[0].type === 'text') {
                            try {
                                const parsed = JSON.parse(result.content[0].text);
                                // Validate against output schema if present
                                if (adapter.outputSchema) {
                                    const validated = adapter.outputSchema.parse(parsed);
                                    // When output schema is defined, return structured content
                                    return {
                                        structuredContent: validated as Record<string, unknown>,
                                        content: [
                                            {
                                                type: 'text',
                                                text: JSON.stringify(validated),
                                            },
                                        ],
                                    };
                                }
                                return {
                                    content: [
                                        {
                                            type: 'text',
                                            text: JSON.stringify(parsed),
                                        },
                                    ],
                                };
                            } catch {
                                return result;
                            }
                        }
                        return result;
                    } catch (error) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: error instanceof Error ? error.message : String(error),
                                },
                            ],
                            isError: true,
                        };
                    }
                },
            );
        }

        return server;
    };

    const adaptersWithComponents = adapters.filter(
        ({ component }) => component instanceof Function,
    );
    const webComponentRegistrations = adaptersWithComponents
        .map(
            ({ name, component }) =>
                `(${registerAndAppendWebComponent.toString()})(${JSON.stringify(name)}, ${component});`,
        )
        .join('\n');

    return {
        name: 'vite-mcp',
        apply: 'serve',
        enforce: 'pre',
        resolveId(id: string) {
            if (id === BRIDGE_PATH) {
                // Return with .ts extension so Vite knows to transform TypeScript
                return RESOLVED_BRIDGE_ID + '.ts';
            }
            if (id === RESOLVED_BRIDGE_ID || id === RESOLVED_BRIDGE_ID + '.ts') {
                return RESOLVED_BRIDGE_ID + '.ts';
            }
            return undefined;
        },
        load(id: string) {
            if (id === RESOLVED_BRIDGE_ID + '.ts') {
                const bridgePath = join(SRC_DIR, 'browser-bridge.ts');
                if (existsSync(bridgePath)) {
                    const bridgeCode = readFileSync(bridgePath, 'utf-8');
                    // Inject web component registrations if any
                    return bridgeCode + (webComponentRegistrations ? `\n${webComponentRegistrations}` : '');
                }
            }
            return undefined;
        },
        transformIndexHtml(html: string) {
            const bridgeScript = `<script type="module" src="${BRIDGE_PATH}"></script>`;
            return html.replace('<head>', `<head>${bridgeScript}`);
        },
        configureServer(server: ViteDevServer) {
            viteServer = server;

            server.ws.on('mcp:tool-result', (data: { id: string; result?: CallToolResult; error?: unknown }) => {
                const { id, result, error } = data;
                const deferred = pendingToolCalls.get(id);
                if (!deferred) {
                    return;
                }
                pendingToolCalls.delete(id);
                if (error) {
                    deferred.reject(error);
                } else if (result) {
                    deferred.resolve(result);
                } else {
                    deferred.reject(new Error('Tool result missing both result and error'));
                }
            });

            const mcpServer = createMcpServer();

            // Handle MCP HTTP endpoints
            // Use a function to match the path instead of passing it directly to use()
            server.middlewares.use(async (req: any, res: any, next: any) => {
                // Check if the request is for the MCP endpoint
                const url = req.url || '';
                const pathname = url.split('?')[0];
                if (pathname === MCP_PATH || pathname === `${MCP_PATH}/` || pathname.startsWith(`${MCP_PATH}/`)) {
                    await mcpServer.handleHTTP(req, res);
                } else {
                    next();
                }
            });
        },
    };
}

export default viteMcp;

// Re-export adapters
export * from './adapter/index.js';
