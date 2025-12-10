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

        if (viteServer?.environments?.default?.hot) {
            viteServer.environments.default.hot.send('mcp:tool-call', { id, name, params: params || {} });
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
                        // Validate input with Zod
                        const validatedInput = adapter.inputSchema.parse(input) as { [key: string]: unknown };
                        const result = await dispatchToolCall(adapter.name, validatedInput);
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
                return RESOLVED_BRIDGE_ID;
            }
            if (id === RESOLVED_BRIDGE_ID) return RESOLVED_BRIDGE_ID;
            return undefined;
        },
        load(id: string) {
            if (id === RESOLVED_BRIDGE_ID) {
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
            // Inject the browser bridge script and WebSocket bridge
            const bridgeScript = `
        <script type="module" src="${BRIDGE_PATH}"></script>
        <script>
          (function() {
            if (import.meta.hot) {
              window.addEventListener('mcp:bridge-ready', function() {
                import.meta.hot.send('mcp:bridge-ready', {});
              });
              
              window.addEventListener('mcp:tool-result', function(event) {
                import.meta.hot.send('mcp:tool-result', event.detail || {});
              });
              
              import.meta.hot.on('mcp:tool-call', function(data) {
                window.dispatchEvent(new CustomEvent('mcp:tool-call', { detail: data }));
              });
            }
          })();
        </script>
      `;
            return html.replace(
                '<head>',
                `<head>${bridgeScript}`,
            );
        },
        configureServer(server: ViteDevServer) {
            viteServer = server;

            // Listen for bridge ready event from browser via HMR
            if (server.environments?.default?.hot) {
                server.environments.default.hot.on('mcp:bridge-ready', () => {
                    log('🔌 MCP Bridge ready!');
                });

                // Listen for tool results from browser
                server.environments.default.hot.on('mcp:tool-result', (data: { id: string; result: CallToolResult }) => {
                    const deferred = pendingToolCalls.get(data.id);
                    if (deferred) {
                        pendingToolCalls.delete(data.id);
                        deferred.resolve(data.result);
                    }
                });
            }

            const mcpServer = createMcpServer();

            // Handle MCP HTTP endpoints
            server.middlewares.use(MCP_PATH, async (req: any, res: any, next: any) => {
                if (req.url === MCP_PATH || req.url === `${MCP_PATH}/` || req.url?.startsWith(`${MCP_PATH}/`)) {
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
