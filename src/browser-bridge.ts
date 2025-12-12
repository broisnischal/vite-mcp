// Browser-side bridge that listens for tool calls from the MCP server
// via Vite's WebSocket and responds with results

/**
 * Bridge
 * @author: @broisnees
 * @description: BrowserBridge class that resolves for the adapters.
 */
class BrowserBridge {
  isReady = false;

  constructor() {
    this.setupViteWebSocket();
  }

  setupViteWebSocket() {
    if (
      typeof window === "undefined" ||
      typeof import.meta === "undefined" ||
      !import.meta.hot
    ) {
      return;
    }

    const hot = import.meta.hot;

    // @ts-ignore - Vite HMR custom events
    hot.on("mcp:tool-call", (data) => {
      if (data && typeof data === "object" && data.id && data.name) {
        this.handleToolCall(data);
      }
    });

    window.addEventListener("mcp:tool-result", (event) => {
      // @ts-ignore - Vite HMR custom events
      hot.send("mcp:tool-result", event.detail || {});
    });

    this.isReady = true;
    window.dispatchEvent(new CustomEvent("mcp:bridge-ready"));
  }

  // @ts-ignore
  async handleToolCall(message) {
    const { id, name, params } = message;
    let result;

    try {
      const data = await this.executeAdapter(name, params || {});
      // Return structured content that matches the output schema
      result = {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
      };
    } catch (error) {
      result = {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }

    if (this.isReady) {
      window.dispatchEvent(
        new CustomEvent("mcp:tool-result", {
          detail: { id, result },
        })
      );
    }
  }

  // @ts-ignore
  detectRoutingFramework() {
    // @ts-ignore
    if (typeof window !== "undefined" && window.__REACT_ROUTER__) {
      return "react-router";
    }
    // @ts-ignore
    if (typeof window !== "undefined" && window.__VUE_ROUTER__) {
      return "vue-router";
    }
    // @ts-ignore
    if (typeof window !== "undefined" && window.__TANSTACK_ROUTER__) {
      return "tanstack-router";
    }
    // @ts-ignore
    if (typeof window !== "undefined" && window.__REMIX__) {
      return "remix";
    }
    // Try to detect React Router via React context
    // @ts-ignore
    if (typeof window !== "undefined" && window.React) {
      try {
        // @ts-ignore
        const reactRoot = document.querySelector("#root") || document.body;
        // @ts-ignore
        const fiber = reactRoot._reactInternalFiber || reactRoot._reactInternalInstance;
        if (fiber) {
          return "react-router";
        }
      } catch (e) {
        // Ignore
      }
    }
    return null;
  }

  // @ts-ignore
  async getComponentRoutes(framework = "auto") {
    const detectedFramework = framework === "auto" ? this.detectRoutingFramework() : framework;
    const routes = [];
    let currentRoute = null;

    if (detectedFramework === "react-router") {
      // Try to access React Router via window or React DevTools
      // @ts-ignore
      if (typeof window !== "undefined" && window.__REACT_ROUTER_STATE__) {
        // @ts-ignore
        const routerState = window.__REACT_ROUTER_STATE__;
        // @ts-ignore
        routes.push(...(routerState.routes || []));
        // @ts-ignore
        currentRoute = routerState.currentRoute || null;
      } else {
        // Fallback: try to detect from URL and common patterns
        const path = window.location.pathname;
        const search = window.location.search;
        const queryParams: Record<string, string> = {};

        if (search) {
          new URLSearchParams(search).forEach((value, key) => {
            queryParams[key] = value;
          });
        }

        routes.push({
          path: path,
          isActive: true,
          params: {},
          query: queryParams,
          framework: "react-router",
        });

        currentRoute = {
          path: path,
          params: {},
          query: queryParams,
        };
      }
    } else if (detectedFramework === "vue-router") {
      // @ts-ignore
      if (typeof window !== "undefined" && window.__VUE_ROUTER_INSTANCE__) {
        // @ts-ignore
        const router = window.__VUE_ROUTER_INSTANCE__;
        // @ts-ignore
        const current = router.currentRoute;
        // @ts-ignore
        routes.push(...(router.getRoutes() || []).map((route) => ({
          path: route.path,
          component: route.name || route.component?.name,
          isActive: route.path === current?.path,
          params: current?.params || {},
          query: current?.query || {},
          framework: "vue-router",
        })));
        currentRoute = {
          path: current?.path || window.location.pathname,
          component: current?.name,
          params: current?.params || {},
          query: current?.query || {},
        };
      } else {
        // Fallback
        const path = window.location.pathname;
        routes.push({
          path: path,
          isActive: true,
          framework: "vue-router",
        });
        currentRoute = {
          path: path,
        };
      }
    } else {
      // Generic fallback: use current URL
      const path = window.location.pathname;
      const search = window.location.search;
      const queryParams: Record<string, string> = {};

      if (search) {
        new URLSearchParams(search).forEach((value, key) => {
          queryParams[key] = value;
        });
      }

      routes.push({
        path: path,
        isActive: true,
        query: queryParams,
      });

      currentRoute = {
        path: path,
        query: queryParams,
      };
    }

    return {
      routes,
      currentRoute,
      framework: detectedFramework || undefined,
    };
  }

  // @ts-ignore
  detectComponentFramework() {
    // @ts-ignore
    if (typeof window !== "undefined" && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      return "react";
    }
    // @ts-ignore
    if (typeof window !== "undefined" && window.__VUE__) {
      return "vue";
    }
    // @ts-ignore
    if (typeof window !== "undefined" && window.__SVELTE__) {
      return "svelte";
    }
    // Try to detect React via fiber
    // @ts-ignore
    if (typeof window !== "undefined" && window.React) {
      try {
        // @ts-ignore
        const reactRoot = document.querySelector("#root") || document.body;
        // @ts-ignore
        const fiber = reactRoot._reactInternalFiber || reactRoot._reactInternalInstance;
        if (fiber) {
          return "react";
        }
      } catch (e) {
        // Ignore
      }
    }
    return null;
  }

  // @ts-ignore
  traverseReactFiber(fiber, maxDepth, currentDepth = 0, includeProps = false, includeState = false, seen = new WeakSet()) {
    if (currentDepth >= maxDepth || !fiber) {
      return null;
    }

    const componentName =
      fiber.type?.displayName ||
      fiber.type?.name ||
      (typeof fiber.type === "string" ? fiber.type : "Unknown");

    const node: any = {
      name: componentName,
      type: fiber.type?.prototype?.isReactComponent ? "class" : "functional",
    };

    if (includeProps && fiber.memoizedProps) {
      // Serialize props safely
      try {
        const propsSeen = new WeakSet();
        node.props = JSON.parse(JSON.stringify(fiber.memoizedProps, (key, value) => {
          // Filter out functions and circular references
          if (typeof value === "function") return "[Function]";
          if (typeof value === "object" && value !== null) {
            if (propsSeen.has(value)) return "[Circular]";
            propsSeen.add(value);
          }
          return value;
        }));
      } catch (e) {
        node.props = { error: "Could not serialize props" };
      }
    }

    if (includeState && fiber.memoizedState) {
      try {
        const stateSeen = new WeakSet();
        node.state = JSON.parse(JSON.stringify(fiber.memoizedState, (key, value) => {
          if (typeof value === "function") return "[Function]";
          if (typeof value === "object" && value !== null) {
            if (stateSeen.has(value)) return "[Circular]";
            stateSeen.add(value);
          }
          return value;
        }));
      } catch (e) {
        node.state = { error: "Could not serialize state" };
      }
    }

    if (fiber.key) {
      node.key = String(fiber.key);
    }

    node.framework = "react";

    const children: any[] = [];
    let child = fiber.child;
    while (child) {
      const childNode = this.traverseReactFiber(
        child,
        maxDepth,
        currentDepth + 1,
        includeProps,
        includeState,
        seen
      );
      if (childNode) {
        children.push(childNode);
      }
      child = child.sibling;
    }

    if (children.length > 0) {
      node.children = children;
    }

    return node;
  }

  // @ts-ignore
  async getComponentTree(framework = "auto", maxDepth = 10, includeProps = false, includeState = false) {
    const detectedFramework = framework === "auto" ? this.detectComponentFramework() : framework;
    let tree = null;
    let componentCount = 0;

    if (detectedFramework === "react") {
      // Try to use React DevTools hook
      // @ts-ignore
      if (typeof window !== "undefined" && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        // @ts-ignore
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        // @ts-ignore
        const roots = hook.getFiberRoots(1) || new Set();
        // @ts-ignore
        const rootFiber = roots.values().next().value?.current;

        if (rootFiber) {
          // @ts-ignore
          tree = this.traverseReactFiber(rootFiber, maxDepth, 0, includeProps, includeState);
          // @ts-ignore
          const countNodes = (node) => {
            if (!node) return 0;
            let count = 1;
            if (node.children) {
              // @ts-ignore
              node.children.forEach((child) => {
                count += countNodes(child);
              });
            }
            return count;
          };
          componentCount = countNodes(tree);
        }
      } else {
        // Fallback: try to access fiber directly
        try {
          // @ts-ignore
          const reactRoot = document.querySelector("#root") || document.body;
          // @ts-ignore
          const fiber = reactRoot._reactInternalFiber || reactRoot._reactInternalInstance?.current;

          if (fiber) {
            // @ts-ignore
            tree = this.traverseReactFiber(fiber, maxDepth, 0, includeProps, includeState);
            // @ts-ignore
            const countNodes = (node) => {
              if (!node) return 0;
              let count = 1;
              if (node.children) {
                // @ts-ignore
                node.children.forEach((child) => {
                  count += countNodes(child);
                });
              }
              return count;
            };
            componentCount = countNodes(tree);
          }
        } catch (e) {
          // Ignore errors
        }
      }
    } else if (detectedFramework === "vue") {
      // @ts-ignore
      if (typeof window !== "undefined" && window.__VUE__) {
        // @ts-ignore
        const app = window.__VUE__;
        // Vue 3 instance
        // @ts-ignore
        if (app._instance) {
          // @ts-ignore
          const instance = app._instance;
          // @ts-ignore
          tree = {
            name: instance.type?.name || instance.type?.__name || "Root",
            type: "component",
            framework: "vue",
          };
          componentCount = 1;
        }
      }
    } else if (detectedFramework === "svelte") {
      // @ts-ignore
      if (typeof window !== "undefined" && window.__SVELTE__) {
        // @ts-ignore
        tree = {
          name: "SvelteApp",
          type: "component",
          framework: "svelte",
        };
        componentCount = 1;
      }
    }

    if (!tree) {
      // Fallback: create a simple tree from DOM
      tree = {
        name: "Document",
        type: "dom",
        children: [],
      };
      componentCount = 1;
    }

    return {
      tree,
      framework: detectedFramework || undefined,
      componentCount,
    };
  }

  // @ts-ignore
  async executeAdapter(name, params = {}) {
    switch (name) {
      case "read_console": {
        // @ts-ignore
        let messages = [];

        // Try to access console messages if devtools-plugin is loaded
        // @ts-ignore
        if (typeof window.__studioConsoleMessages !== "undefined") {
          // @ts-ignore
          messages = [...window.__studioConsoleMessages];
          // @ts-ignore
        } else if (typeof window.__mcpConsoleMessages !== "undefined") {
          // Use our own console message storage
          // @ts-ignore
          messages = [...window.__mcpConsoleMessages];
        }

        // @ts-ignore
        const type = params.type;
        if (type) {
          // @ts-ignore
          messages = messages.filter((m) => m.type === type);
        }
        // @ts-ignore
        const limit = params.limit || 100;
        // @ts-ignore
        return { messages: messages.slice(-limit) };
      }

      case "read_local_storage": {
        return {
          items: Object.keys(localStorage).map((key) => ({
            key,
            value: localStorage.getItem(key) ?? "",
          })),
        };
      }

      case "read_session_storage": {
        return {
          items: Object.keys(sessionStorage).map((key) => ({
            key,
            value: sessionStorage.getItem(key) ?? "",
          })),
        };
      }

      case "read_cookies": {
        return {
          cookies: document.cookie
            .split(";")
            .map((cookie) => {
              const [name, ...valueParts] = cookie.trim().split("=");
              return {
                name: name?.trim() || "",
                value: valueParts.join("=").trim(),
              };
            })
            .filter((c) => c.name),
        };
      }

      case "read_component_routes": {
        // @ts-ignore
        const framework = params.framework || "auto";
        // @ts-ignore
        return await this.getComponentRoutes(framework);
      }

      case "read_component_tree": {
        // @ts-ignore
        const framework = params.framework || "auto";
        // @ts-ignore
        const maxDepth = params.maxDepth || 10;
        // @ts-ignore
        const includeProps = params.includeProps || false;
        // @ts-ignore
        const includeState = params.includeState || false;
        // @ts-ignore
        return await this.getComponentTree(framework, maxDepth, includeProps, includeState);
      }

      default:
        throw new Error(`Unknown adapter: ${name}`);
    }
  }
}

if (typeof window !== "undefined") {
  try {
    // @ts-ignore
    window.__mcpBridge = new BrowserBridge();
  } catch (error) {
    console.error("[MCP Bridge] Failed to initialize bridge:", error);
  }
}

// Capture console messages
if (typeof window !== "undefined") {
  // @ts-ignore
  const consoleMessages = [];
  // @ts-ignore
  window.__mcpConsoleMessages = consoleMessages;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  // @ts-ignore
  const captureMessage = (type, ...args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" ");
    consoleMessages.push({
      type,
      message,
      timestamp: Date.now(),
    });
    // Keep only last 1000 messages
    // @ts-ignore
    if (consoleMessages.length > 1000) {
      // @ts-ignore
      consoleMessages.shift();
    }
  };

  console.log = (...args) => {
    captureMessage("log", ...args);
    originalLog.apply(console, args);
  };

  console.info = (...args) => {
    captureMessage("info", ...args);
    originalInfo.apply(console, args);
  };

  console.warn = (...args) => {
    captureMessage("warn", ...args);
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    captureMessage("error", ...args);
    originalError.apply(console, args);
  };

  console.debug = (...args) => {
    captureMessage("debug", ...args);
    originalDebug.apply(console, args);
  };
}

export { BrowserBridge };
