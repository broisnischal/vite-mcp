import type { Plugin, ViteDevServer } from "vite";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ViteMcpServer } from "./server.js";
import {
  consoleAdapter,
  cookieAdapter,
  localStorageAdapter,
  sessionStorageAdapter,
  componentTreeAdapter,
  componentRoutesAdapter,
  performanceMetricsAdapter,
  cacheAdapter,
  indexedDBAdapter,
} from "./adapter/index.js";
import type { AdapterDefinition } from "./adapter/types.js";
import { Deferred } from "./utils.js";
import packageJson from "../package.json" with { type: "json" };
import { z } from "zod";

if (typeof z === "undefined") {
  throw new Error("zod is not available. Please ensure zod is installed.");
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = __dirname;
const DIST_DIR = join(__dirname, "..", "dist");

const BRIDGE_PATH = "/@vite-mcp/bridge.js";
const VIRTUAL_MCP_ID = "virtual:mcp";
const RESOLVED_BRIDGE_ID = "\0vite-mcp-bridge";
const MCP_PATH = "/__mcp";
const MCP_JSONRPC_PATH = "/_mcp";
const MCP_SSE_PATH = "/__mcp/sse";

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

type AdapterNameToConfigKey<T extends string> =
  T extends "cookie" ? 'cookies' :
  T extends "local_storage" ? 'localStorage' :
  T extends "session_storage" ? 'sessionStorage' :
  T extends "cache" ? 'cache' :
  T extends "indexed_db" ? 'indexedDB' :
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

function buildAdapters(config?: ViteMcpAdapterConfig): AdapterDefinition[] {
  const adapters: AdapterDefinition[] = [
    consoleAdapter,
    componentTreeAdapter,
    componentRoutesAdapter,
    performanceMetricsAdapter,
  ];

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

  if (finalConfig.cookies.enabled !== false) {
    adapters.push(cookieAdapter);
  }

  if (finalConfig.localStorage.enabled !== false) {
    adapters.push(localStorageAdapter);
  }

  if (finalConfig.sessionStorage.enabled !== false) {
    adapters.push(sessionStorageAdapter);
  }

  if (finalConfig.cache.enabled !== false) {
    adapters.push(cacheAdapter);
  }

  if (finalConfig.indexedDB.enabled !== false) {
    adapters.push(indexedDBAdapter);
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
  let isDevMode = false;

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
          const errorResult: CallToolResult = {
            content: [
              {
                type: "text",
                text: "Tool call timeout: Browser bridge may not be ready. Make sure the browser page is open and the dev server is running.",
              },
            ],
            isError: true,
          };
          pending.resolve(errorResult);
        }
      }, 60000);

      deferred.promise.finally(() => clearTimeout(timeout));

      if (!viteServer?.ws) {
        pendingToolCalls.delete(id);
        const errorResult: CallToolResult = {
          content: [
            {
              type: "text",
              text: "Vite WebSocket server is not available. Make sure the dev server is running.",
            },
          ],
          isError: true,
        };
        deferred.resolve(errorResult);
        return deferred.promise;
      }

      try {
        const clientCount = viteServer.ws.clients.size;

        if (clientCount === 0) {
          pendingToolCalls.delete(id);
          const errorResult: CallToolResult = {
            content: [
              {
                type: "text",
                text: "No WebSocket clients connected. Make sure the browser page is open and the dev server is running.",
              },
            ],
            isError: true,
          };
          deferred.resolve(errorResult);
          return deferred.promise;
        }

        const payload = { id, name, params: params || {} };
        if (!params || typeof params !== 'object') {
          console.warn(`[vite-mcp] Invalid params for tool ${name}:`, params);
        }
        (viteServer.ws as any).send("mcp:tool-call", payload);
      } catch (error) {
        pendingToolCalls.delete(id);
        const errorResult: CallToolResult = {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
        deferred.resolve(errorResult);
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
            const result = await dispatchToolCall(adapter.name, input);

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
    enforce: "pre",
    configResolved(config) {
      isDevMode = config.mode === "development";
    },
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

      // Resolve bridge/index.js imports from browser-bridge.ts
      // Handle both absolute and relative paths
      if (id === "/bridge/index.js" || id === "./bridge/index.js" || id === "../bridge/index.js" || id.includes("bridge/index")) {
        const distBridgeIndex = join(DIST_DIR, "bridge", "index.js");
        const srcBridgeIndex = join(SRC_DIR, "bridge", "index.ts");

        // Prefer compiled version from dist, fallback to source
        if (existsSync(distBridgeIndex)) {
          return distBridgeIndex;
        }
        if (existsSync(srcBridgeIndex)) {
          return srcBridgeIndex;
        }
      }

      return undefined;
    },
    load(id: string) {
      if (id === RESOLVED_BRIDGE_ID + ".ts") {
        // During build, return empty module to prevent any code from being bundled
        if (!isDevMode) {
          return "";
        }

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
          let bridgeCode = readFileSync(bridgePath, "utf-8");

          // Strip TypeScript-specific syntax that causes parse errors
          // Replace type assertions and type-only syntax with JavaScript-compatible code
          bridgeCode = bridgeCode.replace(/\((\w+)\s+as\s+\w+\)/g, "$1");
          bridgeCode = bridgeCode.replace(/\/\/\s*@ts-ignore.*\n/g, "");

          const fullCode = bridgeCode +
            (webComponentRegistrations ? `\n${webComponentRegistrations}` : "");
          cachedBridgeCode = fullCode;
          return fullCode;
        }
      }
      return undefined;
    },
    transformIndexHtml(html: string) {
      // Only inject bridge script during development
      if (!isDevMode) {
        return html;
      }

      const consoleCaptureScript = `<script>
(function() {
  if (typeof window === "undefined") return;
  if (!window.__mcpConsoleMessages) {
    window.__mcpConsoleMessages = [];
  }
  var consoleMessages = window.__mcpConsoleMessages;
  var captureMessage = function(type, args) {
    try {
      var message = Array.prototype.map.call(args, function(arg) {
        if (arg === null) return "null";
        if (arg === undefined) return "undefined";
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(" ");
      consoleMessages.push({ type: type, message: message, timestamp: Date.now() });
      if (consoleMessages.length > 1000) consoleMessages.shift();
    } catch (e) {
    }
  };
  var wrapConsoleMethod = function(method) {
    var original = console[method];
    if (original && !original.__mcpWrapped) {
      console[method] = function() {
        captureMessage(method, arguments);
        return original.apply(console, arguments);
      };
      console[method].__mcpWrapped = true;
    }
  };
  var methods = ["log", "info", "warn", "error", "debug"];
  for (var i = 0; i < methods.length; i++) {
    wrapConsoleMethod(methods[i]);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      for (var i = 0; i < methods.length; i++) {
        wrapConsoleMethod(methods[i]);
      }
    });
  }
})();
</script>`;

      const bridgeScript = `<script type="module" src="/virtual:mcp"></script>`;

      if (html.includes("<head>")) {
        return html.replace("<head>", `<head>${consoleCaptureScript}${bridgeScript}`);
      }
      if (html.includes("</head>")) {
        return html.replace("</head>", `${consoleCaptureScript}${bridgeScript}</head>`);
      }
      if (html.includes("<body>")) {
        return html.replace("<body>", `<body>${consoleCaptureScript}${bridgeScript}`);
      }
      return consoleCaptureScript + bridgeScript + html;
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
            pathname === MCP_JSONRPC_PATH ||
            pathname === `${MCP_JSONRPC_PATH}/` ||
            pathname === MCP_SSE_PATH ||
            pathname === `${MCP_SSE_PATH}/` ||
            pathname.startsWith(`${MCP_PATH}/`)
          ) {
            await mcpServer.handleHTTP(req, res);
          } else {
            next();
          }
        } catch (error) {
          log(`Error in middleware: ${error instanceof Error ? error.message : String(error)}`);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
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
