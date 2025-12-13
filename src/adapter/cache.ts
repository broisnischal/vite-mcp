import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

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
};

