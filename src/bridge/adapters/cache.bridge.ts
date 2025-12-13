import type { AdapterBridge } from "../types.js";

export class CacheBridge implements AdapterBridge {
  async execute(params: {
    action: "list" | "get_keys" | "get_entry" | "set_entry" | "delete_entry" | "delete" | "clear";
    cacheName?: string;
    key?: string;
    response?: {
      status?: number;
      statusText?: string;
      headers?: Record<string, string>;
      body?: string;
      url?: string;
    };
  }): Promise<unknown> {
    const action = params.action;
    switch (action) {
      case "list": {
        if (!("caches" in window)) {
          return {
            action: "list",
            cacheNames: [],
            count: 0,
          };
        }
        const cacheNames = await caches.keys();
        return {
          action: "list",
          cacheNames,
          count: cacheNames.length,
        };
      }
      case "get_keys": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName!);
        const keys = await cache.keys();
        return {
          action: "get_keys",
          keys: keys.map((request) => request.url),
          cacheName: params.cacheName,
          count: keys.length,
        };
      }
      case "get_entry": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName!);
        const request = new Request(params.key!);
        const response = await cache.match(request);

        if (!response) {
          return {
            action: "get_entry",
            found: false,
            key: params.key,
            cacheName: params.cacheName,
          };
        }

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const body = await response.text();

        return {
          action: "get_entry",
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
      case "set_entry": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName!);
        const request = new Request(params.key!);
        const responseData = params.response!;

        const response = new Response(responseData.body || "", {
          status: responseData.status || 200,
          statusText: responseData.statusText || "OK",
          headers: responseData.headers || {},
        });

        await cache.put(request, response);
        return {
          action: "set_entry",
          success: true,
          cacheName: params.cacheName,
          key: params.key,
        };
      }
      case "delete_entry": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName!);
        const request = new Request(params.key!);
        const success = await cache.delete(request);
        return {
          action: "delete_entry",
          success,
          cacheName: params.cacheName,
          key: params.key,
        };
      }
      case "delete": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const success = await caches.delete(params.cacheName!);
        return {
          action: "delete",
          success,
          cacheName: params.cacheName,
        };
      }
      case "clear": {
        if (!("caches" in window)) {
          throw new Error("Cache Storage API is not available");
        }
        const cache = await caches.open(params.cacheName!);
        const keys = await cache.keys();
        const count = keys.length;
        for (const key of keys) {
          await cache.delete(key);
        }
        return {
          action: "clear",
          success: true,
          cacheName: params.cacheName,
          deletedCount: count,
        };
      }
      default:
        throw new Error(`Unknown cache action: ${action}`);
    }
  }
}

