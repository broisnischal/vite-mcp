import type { Plugin, ViteDevServer } from "vite";
import { existsSync } from "fs";
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
  performanceMetricsAdapter,
  cacheAdapter,
  indexedDBAdapter,
  testSimpleAdapter,
} from "./adapter/index.js";
import type { AdapterDefinition } from "./adapter/types.js";
import { Deferred } from "./utils.js";
import { mcpBridge } from "./bridge/bridge.js";
import packageJson from "../package.json" with { type: "json" };
import { z } from "zod";
import ansis from "ansis";

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
  transformModule?: RegExp;
  endpoint?: string;
  name?: string;
  disableConsoleCapture?: boolean;
}

function log(message: string) {
  console.log(ansis.gray("[vite-mcp]"), message);
}

function registerAndAppendWebComponent(
  name: string,
  componentFactory: (Base: typeof HTMLElement) => CustomElementConstructor
) {
  if (typeof window === "undefined") return;

  const elementName = `${name}-element`;

  if (!customElements.get(elementName)) {
    customElements.define(elementName, componentFactory(HTMLElement));
  }

  window.addEventListener(
    "load",
    () => {
      const node = document.createElement(elementName);
      document.body.appendChild(node);
    },
    { once: true }
  );
}

type ActionPermissionMap = {
  read: string[];
  write: string[];
  delete: string[];
};

const ACTION_PERMISSIONS: Record<string, ActionPermissionMap> = {
  cookie: {
    read: ["read", "get"],
    write: ["set", "edit"],
    delete: ["remove"],
  },
  local_storage: {
    read: ["read", "get"],
    write: ["set", "edit"],
    delete: ["remove", "clear"],
  },
  session_storage: {
    read: ["read", "get"],
    write: ["set", "edit"],
    delete: ["remove", "clear"],
  },
  cache: {
    read: ["list", "get_keys", "get_entry"],
    write: ["set_entry"],
    delete: ["delete_entry", "delete", "clear"],
  },
  indexed_db: {
    read: ["list_databases", "get_database_info", "get_keys", "get_entry"],
    write: ["set_entry"],
    delete: ["delete_entry", "clear_object_store", "delete_database"],
  },
};

function getAllowedActions(
  adapterName: string,
  permissions: { read?: boolean; write?: boolean; delete?: boolean }
): string[] {
  const actionMap = ACTION_PERMISSIONS[adapterName];
  if (!actionMap) {
    return [];
  }

  const allowed: string[] = [];
  if (permissions.read !== false) {
    allowed.push(...actionMap.read);
  }
  if (permissions.write !== false) {
    allowed.push(...actionMap.write);
  }
  if (permissions.delete !== false) {
    allowed.push(...actionMap.delete);
  }

  return allowed;
}

function restrictAdapter(
  adapter: AdapterDefinition,
  permissions: { read?: boolean; write?: boolean; delete?: boolean }
): AdapterDefinition {
  const allowedActions = getAllowedActions(adapter.name, permissions);

  if (allowedActions.length === 0) {
    throw new Error(
      `Adapter ${adapter.name} has no allowed actions with the current permissions`
    );
  }

  const originalInputSchema = adapter.inputSchema as z.ZodObject<any>;
  const actionField = originalInputSchema.shape?.["action"];

  if (!actionField) {
    return adapter;
  }

  let restrictedActionSchema: z.ZodTypeAny;

  if (actionField instanceof z.ZodUnion) {
    const allowedLiterals = actionField.options.filter((option: any) => {
      if (option instanceof z.ZodLiteral) {
        const value = option.value as string;
        return allowedActions.includes(value);
      }
      return false;
    }) as z.ZodLiteral<string>[];

    if (allowedLiterals.length === 0) {
      throw new Error(
        `No allowed actions found for adapter ${adapter.name} with current permissions`
      );
    }

    restrictedActionSchema = allowedLiterals.length === 1
      ? allowedLiterals[0]!
      : z.union(allowedLiterals as [z.ZodLiteral<string>, z.ZodLiteral<string>, ...z.ZodLiteral<string>[]]);
  } else if (actionField instanceof z.ZodEnum) {
    const enumValues = actionField.options as readonly string[];
    const allowedEnumValues = enumValues.filter((val) =>
      allowedActions.includes(val)
    ) as [string, ...string[]];

    if (allowedEnumValues.length === 0) {
      throw new Error(
        `No allowed actions found for adapter ${adapter.name} with current permissions`
      );
    }

    restrictedActionSchema = z.enum(allowedEnumValues);
  } else {
    return adapter;
  }

  const restrictedInputSchema = originalInputSchema.extend({
    action: restrictedActionSchema.describe("Action to perform"),
  });

  let restrictedOutputSchema: z.ZodTypeAny | undefined = adapter.outputSchema;
  if (adapter.outputSchema) {
    const outputSchema = adapter.outputSchema as z.ZodObject<any>;
    const outputActionField = outputSchema.shape?.["action"];

    if (outputActionField instanceof z.ZodEnum) {
      const enumValues = outputActionField.options as readonly string[];
      const allowedOutputEnumValues = enumValues.filter((val) =>
        allowedActions.includes(val)
      ) as [string, ...string[]];

      if (allowedOutputEnumValues.length > 0) {
        restrictedOutputSchema = outputSchema.extend({
          action: z.enum(allowedOutputEnumValues).describe("The action that was performed"),
        });
      }
    }
  }

  const allowedActionsJson = JSON.stringify(allowedActions);
  const adapterNameJson = JSON.stringify(adapter.name);
  const originalHandlerCode = adapter.handler.toString();
  const adapterServerJson = JSON.stringify(adapter.server || {});

  const restrictedHandler = async function (params?: { [key: string]: unknown }): Promise<CallToolResult> {
    const action = params?.["action"] as string | undefined;

    if (!action) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Missing required parameter 'action' for ${adapter.name} adapter`,
            }),
          },
        ],
        isError: true,
      };
    }

    if (!allowedActions.includes(action)) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Action '${action}' is not allowed for ${adapter.name} adapter with current permissions. Allowed actions: ${allowedActions.join(", ")}`,
            }),
          },
        ],
        isError: true,
      };
    }

    return await adapter.handler.call({ server: adapter.server || {} }, params);
  };

  restrictedHandler.toString = function () {
    return `async function(params) {
  const allowedActions = ${allowedActionsJson};
  const adapterName = ${adapterNameJson};
  const originalHandler = ${originalHandlerCode};
  const adapterServer = ${adapterServerJson};
  
  const action = params?.["action"];
  
  if (!action) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Missing required parameter 'action' for " + adapterName + " adapter",
          }),
        },
      ],
      isError: true,
    };
  }
  
  if (!allowedActions.includes(action)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Action '" + action + "' is not allowed for " + adapterName + " adapter with current permissions. Allowed actions: " + allowedActions.join(", "),
          }),
        },
      ],
      isError: true,
    };
  }
  
  return await originalHandler.call({ server: adapterServer }, params);
}`;
  };

  const result: AdapterDefinition = {
    ...adapter,
    inputSchema: restrictedInputSchema,
    handler: restrictedHandler,
    description: `${adapter.description} (Allowed actions: ${allowedActions.join(", ")})`,
  };

  if (restrictedOutputSchema) {
    result.outputSchema = restrictedOutputSchema;
  }

  return result;
}

function buildAdapters(config?: ViteMcpAdapterConfig): AdapterDefinition[] {
  const adapters: AdapterDefinition[] = [
    consoleAdapter,
    componentTreeAdapter,
    performanceMetricsAdapter,
    testSimpleAdapter,
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
    const cookiePerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
    if (finalConfig.cookies.read !== undefined) cookiePerms.read = finalConfig.cookies.read;
    if (finalConfig.cookies.write !== undefined) cookiePerms.write = finalConfig.cookies.write;
    if (finalConfig.cookies.delete !== undefined) cookiePerms.delete = finalConfig.cookies.delete;
    adapters.push(restrictAdapter(cookieAdapter, cookiePerms));
  }

  if (finalConfig.localStorage.enabled !== false) {
    const lsPerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
    if (finalConfig.localStorage.read !== undefined) lsPerms.read = finalConfig.localStorage.read;
    if (finalConfig.localStorage.write !== undefined) lsPerms.write = finalConfig.localStorage.write;
    if (finalConfig.localStorage.delete !== undefined) lsPerms.delete = finalConfig.localStorage.delete;
    adapters.push(restrictAdapter(localStorageAdapter, lsPerms));
  }

  if (finalConfig.sessionStorage.enabled !== false) {
    const ssPerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
    if (finalConfig.sessionStorage.read !== undefined) ssPerms.read = finalConfig.sessionStorage.read;
    if (finalConfig.sessionStorage.write !== undefined) ssPerms.write = finalConfig.sessionStorage.write;
    if (finalConfig.sessionStorage.delete !== undefined) ssPerms.delete = finalConfig.sessionStorage.delete;
    adapters.push(restrictAdapter(sessionStorageAdapter, ssPerms));
  }

  if (finalConfig.cache.enabled !== false) {
    const cachePerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
    if (finalConfig.cache.read !== undefined) cachePerms.read = finalConfig.cache.read;
    if (finalConfig.cache.write !== undefined) cachePerms.write = finalConfig.cache.write;
    if (finalConfig.cache.delete !== undefined) cachePerms.delete = finalConfig.cache.delete;
    adapters.push(restrictAdapter(cacheAdapter, cachePerms));
  }

  if (finalConfig.indexedDB.enabled !== false) {
    const idbPerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
    if (finalConfig.indexedDB.read !== undefined) idbPerms.read = finalConfig.indexedDB.read;
    if (finalConfig.indexedDB.write !== undefined) idbPerms.write = finalConfig.indexedDB.write;
    if (finalConfig.indexedDB.delete !== undefined) idbPerms.delete = finalConfig.indexedDB.delete;
    adapters.push(restrictAdapter(indexedDBAdapter, idbPerms));
  }

  return adapters;
}

export function viteMcp<
  TAdapters extends readonly AdapterDefinition[] | undefined = AdapterDefinition[] | undefined
>(
  options: ViteMcpOptions<TAdapters> = {} as ViteMcpOptions<TAdapters>
): Plugin {
  let adapters = options.adapters || buildAdapters(options.adapterConfig);
  const transformModule = options.transformModule;
  const disableConsoleCapture = options.disableConsoleCapture === true;

  if (options.adapters && options.adapterConfig) {
    const configMap: Record<string, { read?: boolean; write?: boolean; delete?: boolean }> = {};

    if (options.adapterConfig.cookies) {
      const cookiePerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
      if (options.adapterConfig.cookies.read !== undefined) cookiePerms.read = options.adapterConfig.cookies.read;
      if (options.adapterConfig.cookies.write !== undefined) cookiePerms.write = options.adapterConfig.cookies.write;
      if (options.adapterConfig.cookies.delete !== undefined) cookiePerms.delete = options.adapterConfig.cookies.delete;
      configMap["cookie"] = cookiePerms;
    }

    if (options.adapterConfig.localStorage) {
      const lsPerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
      if (options.adapterConfig.localStorage.read !== undefined) lsPerms.read = options.adapterConfig.localStorage.read;
      if (options.adapterConfig.localStorage.write !== undefined) lsPerms.write = options.adapterConfig.localStorage.write;
      if (options.adapterConfig.localStorage.delete !== undefined) lsPerms.delete = options.adapterConfig.localStorage.delete;
      configMap["local_storage"] = lsPerms;
    }

    if (options.adapterConfig.sessionStorage) {
      const ssPerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
      if (options.adapterConfig.sessionStorage.read !== undefined) ssPerms.read = options.adapterConfig.sessionStorage.read;
      if (options.adapterConfig.sessionStorage.write !== undefined) ssPerms.write = options.adapterConfig.sessionStorage.write;
      if (options.adapterConfig.sessionStorage.delete !== undefined) ssPerms.delete = options.adapterConfig.sessionStorage.delete;
      configMap["session_storage"] = ssPerms;
    }

    if (options.adapterConfig.cache) {
      const cachePerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
      if (options.adapterConfig.cache.read !== undefined) cachePerms.read = options.adapterConfig.cache.read;
      if (options.adapterConfig.cache.write !== undefined) cachePerms.write = options.adapterConfig.cache.write;
      if (options.adapterConfig.cache.delete !== undefined) cachePerms.delete = options.adapterConfig.cache.delete;
      configMap["cache"] = cachePerms;
    }

    if (options.adapterConfig.indexedDB) {
      const idbPerms: { read?: boolean; write?: boolean; delete?: boolean } = {};
      if (options.adapterConfig.indexedDB.read !== undefined) idbPerms.read = options.adapterConfig.indexedDB.read;
      if (options.adapterConfig.indexedDB.write !== undefined) idbPerms.write = options.adapterConfig.indexedDB.write;
      if (options.adapterConfig.indexedDB.delete !== undefined) idbPerms.delete = options.adapterConfig.indexedDB.delete;
      configMap["indexed_db"] = idbPerms;
    }

    adapters = adapters.map((adapter) => {
      const perms = configMap[adapter.name];
      if (perms && ACTION_PERMISSIONS[adapter.name]) {
        return restrictAdapter(adapter, perms);
      }
      return adapter;
    });
  }

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
        console.log(ansis.gray("[vite-mcp]"), ansis.yellow("Bridge: Bridge not ready because HMR not available."));
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
          console.log(ansis.gray("[vite-mcp]"), ansis.yellow("Bridge: Bridge not ready because HMR not available."));
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

            if (result.structuredContent) {
              return result;
            }

            if (
              result.content &&
              result.content.length > 0 &&
              result.content[0]?.type === "text"
            ) {
              try {
                const parsed = JSON.parse(result.content[0].text);
                if (adapter.outputSchema && typeof adapter.outputSchema.parse === "function") {
                  try {
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
                  } catch (parseError) {
                    log(`Output schema validation failed for ${adapter.name}, returning unvalidated result: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                    return {
                      structuredContent: parsed as Record<string, unknown>,
                      content: [
                        {
                          type: "text",
                          text: JSON.stringify(parsed),
                        },
                      ],
                    };
                  }
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
                if (adapter.outputSchema) {
                  log(`Failed to parse result for ${adapter.name}, but output schema is defined. Returning default structure.`);
                  if (adapter.name === "read-console") {
                    return {
                      structuredContent: { logs: [] } as Record<string, unknown>,
                      content: result.content,
                    };
                  }
                  try {
                    const defaultStructure = adapter.outputSchema.parse({});
                    return {
                      structuredContent: defaultStructure as Record<string, unknown>,
                      content: result.content,
                    };
                  } catch {
                    return {
                      structuredContent: { logs: [] } as Record<string, unknown>,
                      content: result.content,
                    };
                  }
                }
                return result;
              }
            }
            if (adapter.outputSchema && !result.structuredContent) {
              log(`No structured content for ${adapter.name} but output schema is defined. Returning default structure.`);
              if (adapter.name === "read-console") {
                return {
                  structuredContent: { logs: [] } as Record<string, unknown>,
                  content: result.content || [],
                };
              }
              try {
                const defaultStructure = adapter.outputSchema.parse({});
                return {
                  structuredContent: defaultStructure as Record<string, unknown>,
                  content: result.content || [],
                };
              } catch {
                return {
                  structuredContent: { logs: [] } as Record<string, unknown>,
                  content: result.content || [],
                };
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

        const serializedToolHandlers = adapters
          .map(
            ({ name, handler }) =>
              `[${JSON.stringify(name)}, {handler: ${handler.toString()}}]`
          )
          .join(",");

        const consoleCaptureScript = disableConsoleCapture ? '' : `
(function() {
  if (typeof window === "undefined") return;
  if (window.__mcpConsoleCaptureInitialized) return;
  window.__mcpConsoleCaptureInitialized = true;
  
  if (!window.__mcpConsoleEntries) {
    window.__mcpConsoleEntries = [];
  }
  var consoleEntries = window.__mcpConsoleEntries;
  var captureEntry = function(level, args) {
    try {
      var entryArgs = Array.prototype.slice.call(args);
      consoleEntries.push({ 
        level: level, 
        args: entryArgs, 
        timestamp: Date.now() 
      });
      if (consoleEntries.length > 1000) consoleEntries.shift();
    } catch (e) {
    }
  };
  var wrapConsoleMethod = function(method) {
    if (!console[method]) return;
    var original = console[method];
    if (original && !original.__mcpWrapped) {
      var wrapped = function() {
        captureEntry(method, arguments);
        return original.apply(console, arguments);
      };
      try {
        Object.defineProperty(wrapped, 'name', { 
          value: original.name || method, 
          configurable: true
        });
        if (original.toString) {
          Object.defineProperty(wrapped, 'toString', { 
            value: function() { return original.toString(); },
            configurable: true
          });
        }
        Object.defineProperty(wrapped, 'length', {
          value: original.length || 0,
          configurable: true
        });
      } catch (e) {
      }
      try {
        var proto = Object.getPrototypeOf(original);
        if (proto) {
          Object.setPrototypeOf(wrapped, proto);
        }
      } catch (e) {
      }
      try {
        Object.defineProperty(console, method, {
          value: wrapped,
          writable: true,
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(console[method], '__mcpWrapped', {
          value: true,
          configurable: true,
          enumerable: false,
          writable: false
        });
      } catch (e) {
        console[method] = wrapped;
        console[method].__mcpWrapped = true;
      }
    }
  };
  var methods = ["log", "info", "warn", "error", "debug"];
  setTimeout(function() {
    for (var i = 0; i < methods.length; i++) {
      wrapConsoleMethod(methods[i]);
    }
  }, 0);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      for (var i = 0; i < methods.length; i++) {
        wrapConsoleMethod(methods[i]);
      }
    });
  }
})();
`;

        const bridgeCode = `${consoleCaptureScript}\n(${mcpBridge.toString()})(import.meta.hot, new Map([${serializedToolHandlers}]), ${Deferred.toString()});`;

        const fullCode =
          bridgeCode +
          (webComponentRegistrations ? `\n${webComponentRegistrations}` : "");
        cachedBridgeCode = fullCode;
        return fullCode;
      }
      return undefined;
    },
    transform(code: string, id: string) {
      if (!transformModule || !isDevMode) return;

      if (!transformModule.test(id)) return;

      const bridgeImport = `import "${VIRTUAL_MCP_ID}";\n`;
      const prependedCode = bridgeImport + (webComponentRegistrations ? webComponentRegistrations + "\n" : "") + code;

      return { code: prependedCode };
    },
    transformIndexHtml(html: string) {
      if (transformModule) return html;

      // Only inject bridge script during development
      if (!isDevMode) {
        return html;
      }

      const consoleCaptureScript = disableConsoleCapture ? '' : `<script>
(function() {
  if (typeof window === "undefined") return;
  if (window.__mcpConsoleCaptureInitialized) return;
  window.__mcpConsoleCaptureInitialized = true;
  
  if (!window.__mcpConsoleEntries) {
    window.__mcpConsoleEntries = [];
  }
  var consoleEntries = window.__mcpConsoleEntries;
  var captureEntry = function(level, args) {
    try {
      var entryArgs = Array.prototype.slice.call(args);
      consoleEntries.push({ 
        level: level, 
        args: entryArgs, 
        timestamp: Date.now() 
      });
      if (consoleEntries.length > 1000) consoleEntries.shift();
    } catch (e) {
    }
  };
  var wrapConsoleMethod = function(method) {
    if (!console[method]) return;
    var original = console[method];
    if (original && !original.__mcpWrapped) {
      var wrapped = function() {
        captureEntry(method, arguments);
        return original.apply(console, arguments);
      };
      try {
        Object.defineProperty(wrapped, 'name', { 
          value: original.name || method, 
          configurable: true
        });
        if (original.toString) {
          Object.defineProperty(wrapped, 'toString', { 
            value: function() { return original.toString(); },
            configurable: true
          });
        }
        Object.defineProperty(wrapped, 'length', {
          value: original.length || 0,
          configurable: true
        });
      } catch (e) {
      }
      try {
        var proto = Object.getPrototypeOf(original);
        if (proto) {
          Object.setPrototypeOf(wrapped, proto);
        }
      } catch (e) {
      }
      try {
        Object.defineProperty(console, method, {
          value: wrapped,
          writable: true,
          configurable: true,
          enumerable: true
        });
        Object.defineProperty(console[method], '__mcpWrapped', {
          value: true,
          configurable: true,
          enumerable: false,
          writable: false
        });
      } catch (e) {
        console[method] = wrapped;
        console[method].__mcpWrapped = true;
      }
    }
  };
  var methods = ["log", "info", "warn", "error", "debug"];
  setTimeout(function() {
    for (var i = 0; i < methods.length; i++) {
      wrapConsoleMethod(methods[i]);
    }
  }, 0);
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

      server.ws.on("mcp:bridge-ready", () => {
        console.log(ansis.gray("[vite-mcp]"), ansis.green.bold("Bridge ready!"));
      });

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

      server.ws.on("mcp:tool-server-call", async ({ id, name, params }) => {
        const [toolName, methodName] = name.split(":");

        const adapter = adapters.find((adapter) => adapter.name === toolName);

        if (!adapter) {
          server.ws.send("mcp:tool-server-result", {
            id,
            error: `Adapter not found: ${toolName}`,
          });
          return;
        }

        const method = adapter.server?.[methodName];

        if (!method) {
          server.ws.send("mcp:tool-server-result", {
            id,
            error: `Method not found: ${methodName}`,
          });
          return;
        }

        try {
          const result = await method(params);
          server.ws.send("mcp:tool-server-result", { id, result });
        } catch (error) {
          server.ws.send("mcp:tool-server-result", {
            id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      const mcpServer = createMcpServer();
      mcpServer.markInitialized();

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
            pathname === `${MCP_PATH}/health` ||
            pathname === `${MCP_PATH}/health/` ||
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
