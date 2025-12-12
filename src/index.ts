import type { Plugin, ViteDevServer } from "vite";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ViteMcpServer } from "./server.js";
import {
  consoleAdapter,
  cookieAdapter,
  getCookieAdapter,
  setCookieAdapter,
  editCookieAdapter,
  removeCookieAdapter,
  localStorageAdapter,
  getLocalStorageAdapter,
  setLocalStorageAdapter,
  editLocalStorageAdapter,
  removeLocalStorageAdapter,
  clearLocalStorageAdapter,
  sessionAdapter,
  getSessionStorageAdapter,
  setSessionStorageAdapter,
  editSessionStorageAdapter,
  removeSessionStorageAdapter,
  clearSessionStorageAdapter,
  componentTreeAdapter,
  componentRoutesAdapter,
  performanceMetricsAdapter,
  listCachesAdapter,
  getCacheKeysAdapter,
  getCacheEntryAdapter,
  setCacheEntryAdapter,
  deleteCacheEntryAdapter,
  deleteCacheAdapter,
  clearCacheAdapter,
  listIndexedDBDatabasesAdapter,
  getIndexedDBDatabaseInfoAdapter,
  getIndexedDBKeysAdapter,
  getIndexedDBEntryAdapter,
  setIndexedDBEntryAdapter,
  deleteIndexedDBEntryAdapter,
  clearIndexedDBObjectStoreAdapter,
  deleteIndexedDBDatabaseAdapter,
} from "./adapter/index.js";
import type { AdapterDefinition } from "./adapter/types.js";
import { Deferred } from "./utils.js";
import packageJson from "../package.json" with { type: "json" };

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = __dirname;
const DIST_DIR = join(__dirname, "..", "dist");

const BRIDGE_PATH = "/@vite-mcp/bridge.js";
const VIRTUAL_MCP_ID = "virtual:mcp";
const RESOLVED_BRIDGE_ID = "\0vite-mcp-bridge";
const MCP_PATH = "/__mcp";

export interface ViteMcpAdapterConfig {
  cookies?: {
    enabled?: boolean;
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  localStorage?: {
    enabled?: boolean;
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  sessionStorage?: {
    enabled?: boolean;
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  cache?: {
    enabled?: boolean;
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
  indexedDB?: {
    enabled?: boolean;
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
}

// Type helpers for conditional adapter config
// Map adapter name to config key
type AdapterNameToConfigKey<T extends string> =
  T extends `${string}cookie${string}` ? 'cookies' :
  T extends `${string}local_storage${string}` ? 'localStorage' :
  T extends `${string}session_storage${string}` ? 'sessionStorage' :
  T extends `${string}cache${string}` ? 'cache' :
  T extends `${string}indexed_db${string}` ? 'indexedDB' :
  never;

// Get all config keys from adapters (as a union)
// This works by distributing over each adapter in the array
type GetConfigKeysUnion<T extends readonly AdapterDefinition[]> =
  T extends readonly AdapterDefinition[]
  ? T[number] extends infer Adapter
  ? Adapter extends AdapterDefinition
  ? AdapterNameToConfigKey<Adapter['name']>
  : never
  : never
  : never;

// Get unique config keys and build conditional config type
type ConditionalAdapterConfig<
  TAdapters extends readonly AdapterDefinition[] | undefined
> = TAdapters extends readonly AdapterDefinition[]
  ? GetConfigKeysUnion<TAdapters> extends never
  ? ViteMcpAdapterConfig // If no matching adapters, allow all config (for adapters like console, component-tree)
  : Pick<ViteMcpAdapterConfig, GetConfigKeysUnion<TAdapters>>
  : ViteMcpAdapterConfig; // If adapters not provided, allow all config (buildAdapters will be used)

export interface ViteMcpOptions<
  TAdapters extends readonly AdapterDefinition[] | undefined = AdapterDefinition[] | undefined
> {
  adapters?: TAdapters;
  adapterConfig?: ConditionalAdapterConfig<TAdapters>;
}

function log(message: string) {
  console.log(`[vite-mcp] ${message}`);
}

function registerAndAppendWebComponent(
  name: string,
  component: () => HTMLElement | Promise<HTMLElement>
) {
  if (typeof window === "undefined") return;

  customElements.define(
    `mcp-adapter-${name}`,
    class extends HTMLElement {
      connectedCallback() {
        Promise.resolve(component()).then((el) => {
          this.appendChild(el);
        });
      }
    }
  );
}

// Helper function to build adapters based on configuration
function buildAdapters(config?: ViteMcpAdapterConfig): AdapterDefinition[] {
  const adapters: AdapterDefinition[] = [
    consoleAdapter,
    componentTreeAdapter,
    componentRoutesAdapter,
    performanceMetricsAdapter,
  ];

  // Default: all features enabled
  const defaultConfig: Required<ViteMcpAdapterConfig> = {
    cookies: { enabled: true, read: true, write: true, delete: true },
    localStorage: { enabled: true, read: true, write: true, delete: true },
    sessionStorage: { enabled: true, read: true, write: true, delete: true },
    cache: { enabled: true, read: true, write: true, delete: true },
    indexedDB: { enabled: true, read: true, write: true, delete: true },
  };

  const finalConfig = {
    cookies: { ...defaultConfig.cookies, ...(config?.cookies || {}) },
    localStorage: { ...defaultConfig.localStorage, ...(config?.localStorage || {}) },
    sessionStorage: { ...defaultConfig.sessionStorage, ...(config?.sessionStorage || {}) },
    cache: { ...defaultConfig.cache, ...(config?.cache || {}) },
    indexedDB: { ...defaultConfig.indexedDB, ...(config?.indexedDB || {}) },
  };

  // Cookie adapters
  if (finalConfig.cookies.enabled !== false) {
    if (finalConfig.cookies.read !== false) {
      adapters.push(cookieAdapter, getCookieAdapter);
    }
    if (finalConfig.cookies.write !== false) {
      adapters.push(setCookieAdapter, editCookieAdapter);
    }
    if (finalConfig.cookies.delete !== false) {
      adapters.push(removeCookieAdapter);
    }
  }

  // LocalStorage adapters
  if (finalConfig.localStorage.enabled !== false) {
    if (finalConfig.localStorage.read !== false) {
      adapters.push(localStorageAdapter, getLocalStorageAdapter);
    }
    if (finalConfig.localStorage.write !== false) {
      adapters.push(setLocalStorageAdapter, editLocalStorageAdapter);
    }
    if (finalConfig.localStorage.delete !== false) {
      adapters.push(removeLocalStorageAdapter, clearLocalStorageAdapter);
    }
  }

  // SessionStorage adapters
  if (finalConfig.sessionStorage.enabled !== false) {
    if (finalConfig.sessionStorage.read !== false) {
      adapters.push(sessionAdapter, getSessionStorageAdapter);
    }
    if (finalConfig.sessionStorage.write !== false) {
      adapters.push(setSessionStorageAdapter, editSessionStorageAdapter);
    }
    if (finalConfig.sessionStorage.delete !== false) {
      adapters.push(removeSessionStorageAdapter, clearSessionStorageAdapter);
    }
  }

  // Cache adapters
  if (finalConfig.cache.enabled !== false) {
    if (finalConfig.cache.read !== false) {
      adapters.push(
        listCachesAdapter,
        getCacheKeysAdapter,
        getCacheEntryAdapter
      );
    }
    if (finalConfig.cache.write !== false) {
      adapters.push(setCacheEntryAdapter);
    }
    if (finalConfig.cache.delete !== false) {
      adapters.push(
        deleteCacheEntryAdapter,
        deleteCacheAdapter,
        clearCacheAdapter
      );
    }
  }

  // IndexedDB adapters
  if (finalConfig.indexedDB.enabled !== false) {
    if (finalConfig.indexedDB.read !== false) {
      adapters.push(
        listIndexedDBDatabasesAdapter,
        getIndexedDBDatabaseInfoAdapter,
        getIndexedDBKeysAdapter,
        getIndexedDBEntryAdapter
      );
    }
    if (finalConfig.indexedDB.write !== false) {
      adapters.push(setIndexedDBEntryAdapter);
    }
    if (finalConfig.indexedDB.delete !== false) {
      adapters.push(
        deleteIndexedDBEntryAdapter,
        clearIndexedDBObjectStoreAdapter,
        deleteIndexedDBDatabaseAdapter
      );
    }
  }

  return adapters;
}

export function viteMcp<
  TAdapters extends readonly AdapterDefinition[] | undefined = AdapterDefinition[] | undefined
>(
  options: ViteMcpOptions<TAdapters> = {} as ViteMcpOptions<TAdapters>
): Plugin {
  const adapters = options.adapters || buildAdapters(options.adapterConfig);

  let viteServer: ViteDevServer | null = null;
  const pendingToolCalls = new Map<string, Deferred<CallToolResult>>();

  // Cache bridge code to avoid repeated file I/O
  let cachedBridgeCode: string | null = null;

  async function dispatchToolCall(
    name: string,
    params: { [key: string]: unknown }
  ): Promise<CallToolResult> {
    try {
      const id = `${Date.now()}${Math.random()}`;
      const deferred = new Deferred<CallToolResult>();
      pendingToolCalls.set(id, deferred);

      const timeout = setTimeout(() => {
        const pending = pendingToolCalls.get(id);
        if (pending) {
          pendingToolCalls.delete(id);
          pending.reject(
            new Error(
              "Tool call timeout: Browser bridge may not be ready. Make sure the browser page is open and the dev server is running."
            )
          );
        }
      }, 60000);

      deferred.promise.finally(() => clearTimeout(timeout));

      if (!viteServer?.ws) {
        pendingToolCalls.delete(id);
        deferred.reject(
          new Error(
            "Vite WebSocket server is not available. Make sure the dev server is running."
          )
        );
        return deferred.promise;
      }

      try {
        const clientCount = viteServer.ws.clients.size;

        if (clientCount === 0) {
          pendingToolCalls.delete(id);
          deferred.reject(
            new Error(
              "No WebSocket clients connected. Make sure the browser page is open and the dev server is running."
            )
          );
          return deferred.promise;
        }

        const payload = { id, name, params: params || {} };
        (viteServer.ws as any).send("mcp:tool-call", payload);
      } catch (error) {
        pendingToolCalls.delete(id);
        deferred.reject(
          error instanceof Error ? error : new Error(String(error))
        );
      }

      return deferred.promise;
    } catch (error) {
      // Fallback error handling if something goes wrong in the function itself
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }
  }

  const createMcpServer = () => {
    const server = new ViteMcpServer({
      name: "vite-mcp",
      version: packageJson.version || "0.0.2",
      adapters: Array.from(adapters),
    });

    for (const adapter of adapters) {
      server.registerAdapter(
        adapter,
        async (input: { [key: string]: unknown }) => {
          try {
            let validatedInput: { [key: string]: unknown };
            try {
              validatedInput = adapter.inputSchema.parse(input) as {
                [key: string]: unknown;
              };
            } catch (validationError) {
              return {
                content: [
                  {
                    type: "text",
                    text: validationError instanceof Error ? validationError.message : String(validationError),
                  },
                ],
                isError: true,
              };
            }
            const result = await dispatchToolCall(adapter.name, validatedInput);

            if (
              result.content &&
              result.content.length > 0 &&
              result.content[0]?.type === "text"
            ) {
              try {
                const parsed = JSON.parse(result.content[0].text);
                if (adapter.outputSchema) {
                  const validated = adapter.outputSchema.parse(parsed);
                  return {
                    structuredContent: validated as Record<string, unknown>,
                    content: [
                      {
                        type: "text",
                        text: JSON.stringify(validated),
                      },
                    ],
                  };
                }
                return {
                  content: [
                    {
                      type: "text",
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
                  type: "text",
                  text: error instanceof Error ? error.message : String(error),
                },
              ],
              isError: true,
            };
          }
        }
      );
    }

    return server;
  };

  const adaptersWithComponents = adapters.filter(
    ({ component }) => component instanceof Function
  );
  const webComponentRegistrations = adaptersWithComponents
    .map(
      ({ name, component }) =>
        `(${registerAndAppendWebComponent.toString()})(${JSON.stringify(
          name
        )}, ${component});`
    )
    .join("\n");

  return {
    name: "vite-mcp",
    apply: "serve",
    enforce: "pre",
    resolveId(id: string) {
      const normalizedId = id.split("?")[0];
      if (
        normalizedId === VIRTUAL_MCP_ID ||
        normalizedId === "/virtual:mcp" ||
        normalizedId === "virtual:mcp"
      ) {
        return RESOLVED_BRIDGE_ID + ".ts";
      }
      if (id === BRIDGE_PATH) {
        return RESOLVED_BRIDGE_ID + ".ts";
      }
      if (id === RESOLVED_BRIDGE_ID || id === RESOLVED_BRIDGE_ID + ".ts") {
        return RESOLVED_BRIDGE_ID + ".ts";
      }
      return undefined;
    },
    load(id: string) {
      if (id === RESOLVED_BRIDGE_ID + ".ts") {
        // Use cached bridge code if available
        if (cachedBridgeCode !== null) {
          return cachedBridgeCode;
        }

        const distBridgePath = join(DIST_DIR, "browser-bridge.ts");
        const srcBridgePath = join(SRC_DIR, "browser-bridge.ts");
        const bridgePath = existsSync(distBridgePath)
          ? distBridgePath
          : srcBridgePath;

        if (existsSync(bridgePath)) {
          const bridgeCode = readFileSync(bridgePath, "utf-8");
          const fullCode = bridgeCode +
            (webComponentRegistrations ? `\n${webComponentRegistrations}` : "");
          // Cache the result
          cachedBridgeCode = fullCode;
          return fullCode;
        }
      }
      return undefined;
    },
    transformIndexHtml(html: string) {
      const bridgeScript = `<script type="module" src="/virtual:mcp"></script>`;
      if (html.includes("</head>")) {
        return html.replace("</head>", `${bridgeScript}</head>`);
      } else if (html.includes("<head>")) {
        return html.replace("<head>", `<head>${bridgeScript}`);
      }
      if (html.includes("<body>")) {
        return html.replace("<body>", `<body>${bridgeScript}`);
      }
      return bridgeScript + html;
    },
    configureServer(server: ViteDevServer) {
      viteServer = server;

      server.ws.on(
        "mcp:tool-result",
        (data: { id: string; result?: CallToolResult; error?: unknown }) => {
          try {
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
              deferred.reject(
                new Error("Tool result missing both result and error")
              );
            }
          } catch (error) {
            log(`Error handling tool result: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      );

      const mcpServer = createMcpServer();

      server.middlewares.use(async (req: any, res: any, next: any) => {
        try {
          const url = req.url || "";
          const pathname = url.split("?")[0];
          if (
            pathname === MCP_PATH ||
            pathname === `${MCP_PATH}/` ||
            pathname.startsWith(`${MCP_PATH}/`)
          ) {
            await mcpServer.handleHTTP(req, res);
          } else {
            next();
          }
        } catch (error) {
          log(`Error in middleware: ${error instanceof Error ? error.message : String(error)}`);
          if (!res.headersSent) {
            res.writeHead(500);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              error: "Internal server error",
              message: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      });
    },
  };
}

export default viteMcp;

declare module "virtual:mcp" { }
