import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const cacheAdapterInputSchema = z.object({
  action: z.union([
    z.literal("list"),
    z.literal("get_keys"),
    z.literal("get_entry"),
    z.literal("set_entry"),
    z.literal("delete_entry"),
    z.literal("delete"),
    z.literal("clear"),
  ]).describe("Action to perform"),
  cacheName: z.string().optional().describe("Name of the cache (required for most actions)"),
  key: z.string().optional().describe("Request URL/key (required for get_entry, set_entry, delete_entry)"),
  response: z
    .object({
      status: z.number().optional().describe("HTTP status code"),
      statusText: z.string().optional().describe("HTTP status text"),
      headers: z.record(z.string(), z.string()).optional().describe("Response headers"),
      body: z.string().optional().describe("Response body as string"),
      url: z.string().optional().describe("Response URL"),
    })
    .optional()
    .describe("Response data to cache (required for set_entry)"),
});

const cacheAdapterOutputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    cacheNames: z.array(z.string()).describe("Array of cache names"),
    count: z.number().describe("Number of caches"),
  }),
  z.object({
    action: z.literal("get_keys"),
    keys: z.array(z.string()).describe("Array of request URLs/keys in the cache"),
    cacheName: z.string().describe("Name of the cache"),
    count: z.number().describe("Number of keys in the cache"),
  }),
  z.object({
    action: z.literal("get_entry"),
    found: z.boolean().describe("Whether the entry was found"),
    key: z.string().describe("The key that was requested"),
    cacheName: z.string().describe("Name of the cache"),
    response: z
      .object({
        status: z.number().optional().describe("HTTP status code"),
        statusText: z.string().optional().describe("HTTP status text"),
        headers: z.record(z.string(), z.string()).optional().describe("Response headers"),
        body: z.string().optional().describe("Response body as string"),
        url: z.string().optional().describe("Response URL"),
        type: z.string().optional().describe("Response type"),
        ok: z.boolean().optional().describe("Whether response is OK"),
      })
      .optional()
      .describe("Cached response data"),
  }),
  z.object({
    action: z.literal("set_entry"),
    success: z.boolean().describe("Whether the entry was set successfully"),
    cacheName: z.string().describe("Name of the cache"),
    key: z.string().describe("The key that was set"),
  }),
  z.object({
    action: z.literal("delete_entry"),
    success: z.boolean().describe("Whether the entry was deleted successfully"),
    cacheName: z.string().describe("Name of the cache"),
    key: z.string().describe("The key that was deleted"),
  }),
  z.object({
    action: z.literal("delete"),
    success: z.boolean().describe("Whether the cache was deleted successfully"),
    cacheName: z.string().describe("Name of the cache that was deleted"),
  }),
  z.object({
    action: z.literal("clear"),
    success: z.boolean().describe("Whether the cache was cleared successfully"),
    cacheName: z.string().describe("Name of the cache"),
    deletedCount: z.number().describe("Number of entries deleted"),
  }),
]);

export const cacheAdapter: AdapterDefinition = {
  name: "cache",
  description:
    "Manage Cache API: list caches, get keys, get/set/delete entries, delete cache, or clear cache",
  inputSchema: cacheAdapterInputSchema,
  outputSchema: cacheAdapterOutputSchema,
  handler: async function (params?: {
    action?: "list" | "get_keys" | "get_entry" | "set_entry" | "delete_entry" | "delete" | "clear";
    cacheName?: string;
    key?: string;
    response?: {
      status?: number;
      statusText?: string;
      headers?: Record<string, string>;
      body?: string;
      url?: string;
    };
  }): Promise<CallToolResult> {
    if (typeof window === "undefined") {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Not available in server environment" }),
          },
        ],
        isError: true,
      };
    }

    try {
      const action = params?.action;
      if (!action) {
        throw new Error(`Missing required parameter 'action' for cache adapter. Received params: ${JSON.stringify(params)}`);
      }

      let result: unknown;

      switch (action) {
        case "list": {
          if (!("caches" in window)) {
            result = {
              action: "list",
              cacheNames: [],
              count: 0,
            };
            break;
          }
          const cacheNames = await caches.keys();
          result = {
            action: "list",
            cacheNames,
            count: cacheNames.length,
          };
          break;
        }
        case "get_keys": {
          if (!("caches" in window)) {
            throw new Error("Cache Storage API is not available");
          }
          const cache = await caches.open(params.cacheName!);
          const keys = await cache.keys();
          result = {
            action: "get_keys",
            keys: keys.map((request) => request.url),
            cacheName: params.cacheName,
            count: keys.length,
          };
          break;
        }
        case "get_entry": {
          if (!("caches" in window)) {
            throw new Error("Cache Storage API is not available");
          }
          const cache = await caches.open(params.cacheName!);
          const request = new Request(params.key!);
          const response = await cache.match(request);

          if (!response) {
            result = {
              action: "get_entry",
              found: false,
              key: params.key,
              cacheName: params.cacheName,
            };
            break;
          }

          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });

          const body = await response.text();

          result = {
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
          break;
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
          result = {
            action: "set_entry",
            success: true,
            cacheName: params.cacheName,
            key: params.key,
          };
          break;
        }
        case "delete_entry": {
          if (!("caches" in window)) {
            throw new Error("Cache Storage API is not available");
          }
          const cache = await caches.open(params.cacheName!);
          const request = new Request(params.key!);
          const success = await cache.delete(request);
          result = {
            action: "delete_entry",
            success,
            cacheName: params.cacheName,
            key: params.key,
          };
          break;
        }
        case "delete": {
          if (!("caches" in window)) {
            throw new Error("Cache Storage API is not available");
          }
          const success = await caches.delete(params.cacheName!);
          result = {
            action: "delete",
            success,
            cacheName: params.cacheName,
          };
          break;
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
          result = {
            action: "clear",
            success: true,
            cacheName: params.cacheName,
            deletedCount: count,
          };
          break;
        }
        default:
          throw new Error(`Unknown cache action: ${action}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
          },
        ],
        isError: true,
      };
    }
  },
};

