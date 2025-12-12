// Browser-side bridge that listens for tool calls from the MCP server
// via Vite's WebSocket and responds with results

/**
 * Bridge
 * @author: @broisnees
 * @description: BrowserBridge class that resolves for the adapters.
 */

// @ts-nocheck
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
    hot.on("mcp:tool-call", (data) => {
      if (data && typeof data === "object" && data.id && data.name) {
        this.handleToolCall(data);
      }
    });

    window.addEventListener("mcp:tool-result", (event) => {
      hot.send("mcp:tool-result", event.detail || {});
    });

    this.isReady = true;
    window.dispatchEvent(new CustomEvent("mcp:bridge-ready"));
  }

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

  detectRoutingFramework() {
    if (typeof window === "undefined") return null;

    if (window.__REACT_ROUTER__ || window.__REACT_ROUTER_V6__) {
      return "react-router";
    }
    if (window.__VUE_ROUTER__) {
      return "vue-router";
    }
    if (window.__TANSTACK_ROUTER__ || window.__TANSTACK_START__) {
      return "tanstack-router";
    }
    if (window.__REMIX__ || window.__remixContext) {
      return "remix";
    }
    if (window.__NEXT_ROUTER_BASEPATH || window.__NEXT_DATA__) {
      return "next";
    }
    if (window.__SVELTEKIT__) {
      return "sveltekit";
    }
    if (window.React) {
      try {
        const reactRoot = document.querySelector("#root") || document.querySelector("#app") || document.body;
        const fiber = reactRoot._reactInternalFiber || reactRoot._reactInternalInstance || reactRoot.__reactFiber;
        if (fiber) {
          return "react-router";
        }
      } catch (e) { }
    }
    return null;
  }

  async getComponentRoutes(framework = "auto") {
    const detectedFramework = framework === "auto" ? this.detectRoutingFramework() : framework;
    const routes = [];
    let currentRoute = null;

    if (detectedFramework === "react-router") {
      if (window.__REACT_ROUTER_STATE__) {
        const routerState = window.__REACT_ROUTER_STATE__;
        routes.push(...(routerState.routes || []));
        currentRoute = routerState.currentRoute || null;
      } else if (window.__REACT_ROUTER__) {
        const router = window.__REACT_ROUTER__;
        if (router.state && router.state.location) {
          routes.push({
            path: router.state.location.pathname,
            isActive: true,
            params: router.state.params || {},
            query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
            framework: "react-router",
          });
          currentRoute = {
            path: router.state.location.pathname,
            params: router.state.params || {},
            query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
          };
        }
      } else {
        // Fallback: try to detect from URL and common patterns
        const path = window.location.pathname;
        const search = window.location.search;
        const queryParams = {};

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
      if (window.__VUE_ROUTER_INSTANCE__) {
        const router = window.__VUE_ROUTER_INSTANCE__;
        const current = router.currentRoute;
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
    } else if (detectedFramework === "tanstack-router") {
      if (window.__TANSTACK_ROUTER__) {
        const router = window.__TANSTACK_ROUTER__;
        if (router.state) {
          routes.push({
            path: router.state.location.pathname,
            isActive: true,
            params: router.state.params || {},
            query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
            framework: "tanstack-router",
          });
          currentRoute = {
            path: router.state.location.pathname,
            params: router.state.params || {},
            query: router.state.location.search ? Object.fromEntries(new URLSearchParams(router.state.location.search)) : {},
          };
        }
      } else {
        const path = window.location.pathname;
        const search = window.location.search;
        const queryParams = {};
        if (search) {
          new URLSearchParams(search).forEach((value, key) => {
            queryParams[key] = value;
          });
        }
        routes.push({
          path: path,
          isActive: true,
          query: queryParams,
          framework: "tanstack-router",
        });
        currentRoute = {
          path: path,
          query: queryParams,
        };
      }
    } else if (detectedFramework === "remix") {
      if (window.__remixContext || window.__REMIX__) {
        const context = window.__remixContext || window.__REMIX__;
        if (context.route) {
          routes.push({
            path: context.route.path || window.location.pathname,
            isActive: true,
            params: context.params || {},
            framework: "remix",
          });
          currentRoute = {
            path: context.route.path || window.location.pathname,
            params: context.params || {},
          };
        }
      } else {
        const path = window.location.pathname;
        routes.push({
          path: path,
          isActive: true,
          framework: "remix",
        });
        currentRoute = {
          path: path,
        };
      }
    } else {
      // Generic fallback: use current URL
      const path = window.location.pathname;
      const search = window.location.search;
      const queryParams = {};

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

  detectComponentFramework() {
    if (typeof window === "undefined") return null;

    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      return "react";
    }
    if (window.__VUE__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
      return "vue";
    }
    if (window.__SVELTE__ || window.__svelte) {
      return "svelte";
    }
    if (window.React || window.__REACT__) {
      try {
        const reactRoot = document.querySelector("#root") || document.querySelector("#app") || document.querySelector("[data-reactroot]") || document.body;
        const fiber = reactRoot._reactInternalFiber || reactRoot._reactInternalInstance || reactRoot.__reactFiber || reactRoot.__reactInternalInstance;
        if (fiber) {
          return "react";
        }
      } catch (e) { }
    }
    if (document.querySelector("[data-svelte-h]") || document.querySelector("[data-hydrate]")) {
      return "svelte";
    }
    return null;
  }

  traverseReactFiber(fiber, maxDepth, currentDepth = 0, includeProps = false, includeState = false, seen = new WeakSet()) {
    if (currentDepth >= maxDepth || !fiber) {
      return null;
    }

    const componentName =
      fiber.type?.displayName ||
      fiber.type?.name ||
      (typeof fiber.type === "string" ? fiber.type : "Unknown");

    const node = {
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

    const children = [];
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

  traverseDOMTree(element, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth || !element) {
      return null;
    }

    const node = {
      name: element.tagName?.toLowerCase() || element.nodeName?.toLowerCase() || "text",
      type: "dom",
    };

    // Add element attributes as props-like data
    if (element.attributes && element.attributes.length > 0) {
      const attrs = {};
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs[attr.name] = attr.value;
      }
      if (Object.keys(attrs).length > 0) {
        node.props = attrs;
      }
    }

    // Add id and class for easier identification
    if (element.id) {
      node.id = element.id;
    }
    if (element.className && typeof element.className === "string") {
      node.className = element.className;
    }

    // Traverse children
    const children = [];
    let child = element.firstChild;
    while (child) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childNode = this.traverseDOMTree(child, maxDepth, currentDepth + 1);
        if (childNode) {
          children.push(childNode);
        }
      } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        // Include significant text nodes
        const text = child.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          children.push({
            name: "#text",
            type: "text",
            text: text,
          });
        }
      }
      child = child.nextSibling;
    }

    if (children.length > 0) {
      node.children = children;
    }

    return node;
  }

  async getComponentTree(framework = "auto", maxDepth = 10, includeProps = false, includeState = false) {
    const detectedFramework = framework === "auto" ? this.detectComponentFramework() : framework;
    let tree = null;
    let componentCount = 0;

    if (detectedFramework === "react") {
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        try {
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          const rendererID = hook.rendererID || 1;
          const roots = hook.getFiberRoots(rendererID) || hook.getFiberRoots?.(rendererID) || new Set();
          const rootFiber = roots.values().next().value?.current;

          if (rootFiber) {
            tree = this.traverseReactFiber(rootFiber, maxDepth, 0, includeProps, includeState);
            const countNodes = (node) => {
              if (!node) return 0;
              let count = 1;
              if (node.children) {
                node.children.forEach((child) => {
                  count += countNodes(child);
                });
              }
              return count;
            };
            componentCount = countNodes(tree);
          }
        } catch (e) { }
      }

      if (!tree) {
        try {
          const rootSelectors = ["#root", "#app", "[data-reactroot]", "[data-react-root]", "body"];
          for (const selector of rootSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              const el = element;
              const fiber = el._reactInternalFiber ||
                el._reactInternalInstance?.current ||
                el._reactRootContainer?._internalRoot?.current ||
                el.__reactInternalInstance ||
                el.__reactFiber ||
                el._reactRoot;

              if (fiber) {
                tree = this.traverseReactFiber(fiber, maxDepth, 0, includeProps, includeState);
                const countNodes = (node) => {
                  if (!node) return 0;
                  let count = 1;
                  if (node.children) {
                    node.children.forEach((child) => {
                      count += countNodes(child);
                    });
                  }
                  return count;
                };
                componentCount = countNodes(tree);
                break;
              }
            }
          }
        } catch (e) { }
      }
    } else if (detectedFramework === "vue") {
      if (window.__VUE__) {
        try {
          const app = window.__VUE__;
          if (app._instance || app.__instance) {
            const instance = app._instance || app.__instance;
            const traverseVueInstance = (instance, depth = 0) => {
              if (depth >= maxDepth || !instance) return null;

              const node = {
                name: instance.type?.name || instance.type?.__name || instance.$options?.name || "VueComponent",
                type: "component",
                framework: "vue",
              };

              if (includeProps && instance.$props) {
                try {
                  const propsSeen = new WeakSet();
                  node.props = JSON.parse(JSON.stringify(instance.$props, (key, value) => {
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

              if (includeState && instance.$data) {
                try {
                  const stateSeen = new WeakSet();
                  node.state = JSON.parse(JSON.stringify(instance.$data, (key, value) => {
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

              const children = [];
              if (instance.$children) {
                instance.$children.forEach((child) => {
                  const childNode = traverseVueInstance(child, depth + 1);
                  if (childNode) children.push(childNode);
                });
              }

              if (children.length > 0) {
                node.children = children;
              }

              return node;
            };

            tree = traverseVueInstance(instance);
            const countNodes = (node) => {
              if (!node) return 0;
              let count = 1;
              if (node.children) {
                node.children.forEach((child) => {
                  count += countNodes(child);
                });
              }
              return count;
            };
            componentCount = countNodes(tree) || 1;
          }
        } catch (e) { }
      }
    } else if (detectedFramework === "svelte") {
      if (window.__SVELTE__ || window.__svelte) {
        tree = {
          name: "SvelteApp",
          type: "component",
          framework: "svelte",
        };
        componentCount = 1;
      }
    }

    if (!tree) {
      try {
        const rootElement = document.documentElement || document.body || document;
        tree = this.traverseDOMTree(rootElement, maxDepth, 0);

        if (!tree) {
          tree = {
            name: "Document",
            type: "dom",
            children: [],
          };
          componentCount = 1;
        } else {
          const countNodes = (node) => {
            if (!node) return 0;
            let count = 1;
            if (node.children) {
              node.children.forEach((child) => {
                count += countNodes(child);
              });
            }
            return count;
          };
          componentCount = countNodes(tree);
        }
      } catch (e) {
        tree = {
          name: "Document",
          type: "dom",
          children: [],
        };
        componentCount = 1;
      }
    }

    return {
      tree,
      framework: detectedFramework || undefined,
      componentCount,
    };
  }

  // Helper function to get detailed cookie information
  getCookieDetails(name) {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [cookieName, ...valueParts] = cookie.trim().split("=");
      if (cookieName?.trim() === name) {
        const value = valueParts.join("=").trim();
        // Try to get additional cookie info from document.cookie (limited)
        // Note: JavaScript can't read httpOnly, secure, sameSite, etc. directly
        // We can only infer from the cookie string
        const cookieString = document.cookie;
        const cookieMatch = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));

        return {
          name: name,
          value: value,
          size: (name + "=" + value).length,
          // These properties cannot be read via JavaScript, but we include them for structure
          domain: window.location.hostname,
          path: "/", // Default path
          secure: window.location.protocol === "https:",
          httpOnly: false, // Cannot be determined via JavaScript
          sameSite: undefined, // Cannot be determined via JavaScript
          hostOnly: true,
          session: true, // Assume session cookie if no expires
        };
      }
    }
    return null;
  }

  // Helper function to parse all cookies with details
  getAllCookiesWithDetails() {
    const cookies = [];
    const cookieString = document.cookie;

    if (!cookieString) {
      return cookies;
    }

    const cookieParts = cookieString.split(";");
    for (const cookie of cookieParts) {
      const [name, ...valueParts] = cookie.trim().split("=");
      if (name) {
        const value = valueParts.join("=").trim();
        cookies.push({
          name: name.trim(),
          value: value,
          domain: window.location.hostname,
          path: "/",
          secure: window.location.protocol === "https:",
          httpOnly: false, // Cannot be determined via JavaScript
          sameSite: undefined, // Cannot be determined via JavaScript
          hostOnly: true,
          session: true,
          size: (name.trim() + "=" + value).length,
        });
      }
    }

    return cookies;
  }

  // Helper function to set cookie with options
  setCookieWithOptions(name, value, options = {}) {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.path) {
      cookieString += `; path=${options.path}`;
    } else {
      cookieString += `; path=/`;
    }

    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }

    if (options.expires) {
      const expiresDate = new Date(options.expires);
      cookieString += `; expires=${expiresDate.toUTCString()}`;
    } else if (options.maxAge !== undefined) {
      cookieString += `; max-age=${options.maxAge}`;
    }

    if (options.secure) {
      cookieString += `; secure`;
    }

    if (options.sameSite) {
      cookieString += `; samesite=${options.sameSite}`;
    }

    // Note: httpOnly cannot be set via JavaScript
    document.cookie = cookieString;

    return this.getCookieDetails(name);
  }

  async executeAdapter(name, params = {}) {
    switch (name) {
      case "read_console": {
        let messages = [];
        if (typeof window.__studioConsoleMessages !== "undefined") {
          messages = [...window.__studioConsoleMessages];
        } else if (typeof window.__mcpConsoleMessages !== "undefined") {
          messages = [...window.__mcpConsoleMessages];
        }
        const type = params.type;
        if (type) {
          messages = messages.filter((m) => m.type === type);
        }
        const limit = params.limit || 100;
        return { messages: messages.slice(-limit) };
      }

      // Cookie operations
      case "read_cookies": {
        return {
          cookies: this.getAllCookiesWithDetails(),
        };
      }

      case "get_cookie": {
        const cookie = this.getCookieDetails(params.name);
        return {
          cookie: cookie,
        };
      }

      case "set_cookie": {
        const cookie = this.setCookieWithOptions(
          params.name,
          params.value,
          {
            domain: params.domain,
            path: params.path,
            expires: params.expires,
            maxAge: params.maxAge,
            secure: params.secure,
            sameSite: params.sameSite,
          }
        );
        return {
          success: true,
          cookie: cookie,
        };
      }

      case "edit_cookie": {
        const existing = this.getCookieDetails(params.name);
        if (!existing) {
          return {
            success: false,
            cookie: null,
          };
        }
        const cookie = this.setCookieWithOptions(
          params.name,
          params.value !== undefined ? params.value : existing.value,
          {
            domain: params.domain !== undefined ? params.domain : existing.domain,
            path: params.path !== undefined ? params.path : existing.path,
            expires: params.expires,
            maxAge: params.maxAge,
            secure: params.secure !== undefined ? params.secure : existing.secure,
            sameSite: params.sameSite,
          }
        );
        return {
          success: true,
          cookie: cookie,
        };
      }

      case "remove_cookie": {
        // To remove a cookie, set it with an expiration date in the past
        const cookieString = `${encodeURIComponent(params.name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${params.path || "/"}`;
        if (params.domain) {
          document.cookie = `${cookieString}; domain=${params.domain}`;
        } else {
          document.cookie = cookieString;
        }
        return {
          success: true,
        };
      }

      // LocalStorage operations
      case "read_local_storage": {
        const items = Object.keys(localStorage).map((key) => {
          const value = localStorage.getItem(key) ?? "";
          return {
            key,
            value,
            size: new Blob([value]).size,
          };
        });
        const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
        return {
          items,
          totalSize,
          itemCount: items.length,
        };
      }

      case "get_local_storage": {
        const value = localStorage.getItem(params.key);
        return {
          value: value,
          key: params.key,
          size: value ? new Blob([value]).size : 0,
        };
      }

      case "set_local_storage": {
        localStorage.setItem(params.key, params.value);
        return {
          success: true,
          key: params.key,
          value: params.value,
          size: new Blob([params.value]).size,
        };
      }

      case "edit_local_storage": {
        localStorage.setItem(params.key, params.value);
        return {
          success: true,
          key: params.key,
          value: params.value,
          size: new Blob([params.value]).size,
        };
      }

      case "remove_local_storage": {
        const existed = localStorage.getItem(params.key) !== null;
        localStorage.removeItem(params.key);
        return {
          success: existed,
          key: params.key,
        };
      }

      case "clear_local_storage": {
        const count = localStorage.length;
        localStorage.clear();
        return {
          success: true,
          itemCount: count,
        };
      }

      // SessionStorage operations
      case "read_session_storage": {
        const items = Object.keys(sessionStorage).map((key) => {
          const value = sessionStorage.getItem(key) ?? "";
          return {
            key,
            value,
            size: new Blob([value]).size,
          };
        });
        const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
        return {
          items,
          totalSize,
          itemCount: items.length,
        };
      }

      case "get_session_storage": {
        const value = sessionStorage.getItem(params.key);
        return {
          value: value,
          key: params.key,
          size: value ? new Blob([value]).size : 0,
        };
      }

      case "set_session_storage": {
        sessionStorage.setItem(params.key, params.value);
        return {
          success: true,
          key: params.key,
          value: params.value,
          size: new Blob([params.value]).size,
        };
      }

      case "edit_session_storage": {
        sessionStorage.setItem(params.key, params.value);
        return {
          success: true,
          key: params.key,
          value: params.value,
          size: new Blob([params.value]).size,
        };
      }

      case "remove_session_storage": {
        const existed = sessionStorage.getItem(params.key) !== null;
        sessionStorage.removeItem(params.key);
        return {
          success: existed,
          key: params.key,
        };
      }

      case "clear_session_storage": {
        const count = sessionStorage.length;
        sessionStorage.clear();
        return {
          success: true,
          itemCount: count,
        };
      }

      // Cache Storage API operations
      case "list_caches": {
        if (!("caches" in window)) {
          return {
            cacheNames: [],
            count: 0,
          };
        }
        const cacheNames = await caches.keys();
        return {
          cacheNames,
          count: cacheNames.length,
        };
      }

      case "get_cache_keys": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName);
        const keys = await cache.keys();
        return {
          keys: keys.map((request) => request.url),
          cacheName: params.cacheName,
          count: keys.length,
        };
      }

      case "get_cache_entry": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName);
        const request = new Request(params.key);
        const response = await cache.match(request);

        if (!response) {
          return {
            found: false,
            key: params.key,
            cacheName: params.cacheName,
          };
        }

        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const body = await response.text();

        return {
          found: true,
          key: params.key,
          cacheName: params.cacheName,
          response: {
            status: response.status,
            statusText: response.statusText,
            headers,
            body,
            url: response.url,
            type: response.type,
            ok: response.ok,
          },
        };
      }

      case "set_cache_entry": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName);
        const request = new Request(params.key);
        const responseData = params.response;

        const response = new Response(responseData.body || "", {
          status: responseData.status || 200,
          statusText: responseData.statusText || "OK",
          headers: responseData.headers || {},
        });

        await cache.put(request, response);
        return {
          success: true,
          cacheName: params.cacheName,
          key: params.key,
        };
      }

      case "delete_cache_entry": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName);
        const request = new Request(params.key);
        const success = await cache.delete(request);
        return {
          success,
          cacheName: params.cacheName,
          key: params.key,
        };
      }

      case "delete_cache": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const success = await caches.delete(params.cacheName);
        return {
          success,
          cacheName: params.cacheName,
        };
      }

      case "clear_cache": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName);
        const keys = await cache.keys();
        const count = keys.length;
        for (const key of keys) {
          await cache.delete(key);
        }
        return {
          success: true,
          cacheName: params.cacheName,
          deletedCount: count,
        };
      }

      // IndexedDB operations
      case "list_indexed_db_databases": {
        if (!("indexedDB" in window)) {
          return {
            databases: [],
            count: 0,
          };
        }
        // Note: IndexedDB doesn't provide a direct way to list all databases
        // We can only access databases that we know about
        // This is a limitation of the IndexedDB API
        return {
          databases: [],
          count: 0,
        };
      }

      case "get_indexed_db_database_info": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(params.databaseName);
          request.onsuccess = () => {
            const db = request.result;
            const objectStores = [];
            if (db.objectStoreNames) {
              for (let i = 0; i < db.objectStoreNames.length; i++) {
                const storeName = db.objectStoreNames[i];
                const transaction = db.transaction([storeName], "readonly");
                const store = transaction.objectStore(storeName);
                objectStores.push({
                  name: storeName,
                  keyPath: store.keyPath,
                  autoIncrement: store.autoIncrement,
                });
              }
            }
            db.close();
            resolve({
              name: params.databaseName,
              version: db.version,
              objectStores,
              found: true,
            });
          };
          request.onerror = () => {
            resolve({
              name: params.databaseName,
              version: 0,
              objectStores: [],
              found: false,
            });
          };
        });
      }

      case "get_indexed_db_keys": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(params.databaseName);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([params.objectStoreName], "readonly");
            const store = transaction.objectStore(params.objectStoreName);
            const getAllKeysRequest = store.getAllKeys();
            getAllKeysRequest.onsuccess = () => {
              db.close();
              resolve({
                keys: getAllKeysRequest.result,
                databaseName: params.databaseName,
                objectStoreName: params.objectStoreName,
                count: getAllKeysRequest.result.length,
              });
            };
            getAllKeysRequest.onerror = () => {
              db.close();
              reject(new Error("Failed to get keys"));
            };
          };
          request.onerror = () => {
            reject(new Error("Failed to open database"));
          };
        });
      }

      case "get_indexed_db_entry": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(params.databaseName);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([params.objectStoreName], "readonly");
            const store = transaction.objectStore(params.objectStoreName);
            const getRequest = store.get(params.key);
            getRequest.onsuccess = () => {
              db.close();
              resolve({
                found: getRequest.result !== undefined,
                key: params.key,
                value: getRequest.result || null,
                databaseName: params.databaseName,
                objectStoreName: params.objectStoreName,
              });
            };
            getRequest.onerror = () => {
              db.close();
              reject(new Error("Failed to get entry"));
            };
          };
          request.onerror = () => {
            reject(new Error("Failed to open database"));
          };
        });
      }

      case "set_indexed_db_entry": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(params.databaseName);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([params.objectStoreName], "readwrite");
            const store = transaction.objectStore(params.objectStoreName);
            const putRequest = store.put(params.value, params.key);
            putRequest.onsuccess = () => {
              db.close();
              resolve({
                success: true,
                key: putRequest.result || params.key,
                databaseName: params.databaseName,
                objectStoreName: params.objectStoreName,
              });
            };
            putRequest.onerror = () => {
              db.close();
              reject(new Error("Failed to set entry"));
            };
          };
          request.onerror = () => {
            reject(new Error("Failed to open database"));
          };
        });
      }

      case "delete_indexed_db_entry": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(params.databaseName);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([params.objectStoreName], "readwrite");
            const store = transaction.objectStore(params.objectStoreName);
            const deleteRequest = store.delete(params.key);
            deleteRequest.onsuccess = () => {
              db.close();
              resolve({
                success: true,
                key: params.key,
                databaseName: params.databaseName,
                objectStoreName: params.objectStoreName,
              });
            };
            deleteRequest.onerror = () => {
              db.close();
              reject(new Error("Failed to delete entry"));
            };
          };
          request.onerror = () => {
            reject(new Error("Failed to open database"));
          };
        });
      }

      case "clear_indexed_db_object_store": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(params.databaseName);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([params.objectStoreName], "readwrite");
            const store = transaction.objectStore(params.objectStoreName);
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
              db.close();
              resolve({
                success: true,
                databaseName: params.databaseName,
                objectStoreName: params.objectStoreName,
              });
            };
            clearRequest.onerror = () => {
              db.close();
              reject(new Error("Failed to clear object store"));
            };
          };
          request.onerror = () => {
            reject(new Error("Failed to open database"));
          };
        });
      }

      case "delete_indexed_db_database": {
        if (!("indexedDB" in window)) {
          throw new Error("IndexedDB is not available");
        }
        return new Promise((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(params.databaseName);
          deleteRequest.onsuccess = () => {
            resolve({
              success: true,
              databaseName: params.databaseName,
            });
          };
          deleteRequest.onerror = () => {
            reject(new Error("Failed to delete database"));
          };
        });
      }

      case "read_component_routes": {
        const framework = params.framework || "auto";
        return await this.getComponentRoutes(framework);
      }

      case "read_component_tree": {
        const framework = params.framework || "auto";
        const maxDepth = params.maxDepth || 10;
        const includeProps = params.includeProps || false;
        const includeState = params.includeState || false;
        return await this.getComponentTree(framework, maxDepth, includeProps, includeState);
      }

      default:
        throw new Error(`Unknown adapter: ${name}`);
    }
  }
}

if (typeof window !== "undefined") {
  try {
    window.__mcpBridge = new BrowserBridge();
  } catch (error) {
    console.error("[MCP Bridge] Failed to initialize bridge:", error);
  }
}

if (typeof window !== "undefined") {
  const consoleMessages = [];
  window.__mcpConsoleMessages = consoleMessages;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

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
    if (consoleMessages.length > 1000) {
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
