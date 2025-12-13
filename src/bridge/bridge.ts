import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface Tool {
  handler: Handler;
}

export type Handler = (
  this: { component?: HTMLElement | undefined; server: ServerMethods },
  input?: { [key: string]: unknown }
) => Promise<CallToolResult>;

export type ServerMethods = {
  [method: string]: (args?: { [key: string]: unknown }) => Promise<{ [key: string]: unknown } | undefined>;
};

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: any) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function mcpBridge(
  hot: any,
  tools: Map<string, Tool>,
  DeferredClass?: any
) {
  const DeferredConstructor = DeferredClass || Deferred;

  function log(...args: unknown[]) {
    console.log("[vite-mcp] Bridge:", ...args);
  }

  if (!hot) {
    log("Bridge not ready because HMR not available.");
    return;
  }

  log("Bridge ready!");

  hot.send("mcp:bridge-ready");

  const pendingServerMethodCalls = new Map<string, Deferred<CallToolResult>>();

  function handleServerMethodResult({
    id,
    result,
    error,
  }: {
    id: string;
    result?: CallToolResult;
    error?: unknown;
  }) {
    const deferred = pendingServerMethodCalls.get(id);

    if (!deferred) {
      log(`Ignoring server method result for invocation ${id}`);
      return;
    }

    pendingServerMethodCalls.delete(id);

    if (error) {
      deferred.reject(error);
    } else if (result) {
      deferred.resolve(result);
    } else {
      deferred.reject(new Error("Server method result missing both result and error"));
    }
  }

  function handleToolCall({
    id,
    name: toolName,
    params,
  }: {
    id: string;
    name: string;
    params?: { [key: string]: unknown };
  }) {
    try {
      const tool = tools.get(toolName);

      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      const component =
        document.querySelector<HTMLElement>(`${toolName}-element`) ?? undefined;

      const server = new Proxy<ServerMethods>(
        {},
        {
          get(_target, methodName) {
            return (params: { [key: string]: unknown }) => {
              if (typeof methodName !== "string") {
                return Promise.reject(new Error("Method name must be a string"));
              }

              const id = `${Date.now()}${Math.random()}`;
              const name = `${toolName}:${methodName}`;
              const deferred = new DeferredConstructor();

              pendingServerMethodCalls.set(id, deferred);
              hot.send("mcp:tool-server-call", { id, name, params });

              return deferred.promise;
            };
          },
        }
      );

      tool.handler
        .call({ component, server }, params)
        .then((result: CallToolResult) => {
          hot.send("mcp:tool-result", { id, result });
        })
        .catch((error: unknown) => {
          hot.send("mcp:tool-result", {
            id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } catch (error) {
      hot.send("mcp:tool-result", {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  hot.on("mcp:tool-call", handleToolCall);
  hot.on("mcp:tool-server-result", handleServerMethodResult);
}

