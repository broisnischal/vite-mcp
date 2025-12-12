import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

// List cache names input/output
export const listCachesInputSchema = z.object({});

export const listCachesOutputSchema = z.object({
  cacheNames: z.array(z.string()).describe("Array of cache names"),
  count: z.number().describe("Number of caches"),
});

// Get cache keys input/output
export const getCacheKeysInputSchema = z.object({
  cacheName: z.string().describe("Name of the cache"),
});

export const getCacheKeysOutputSchema = z.object({
  keys: z.array(z.string()).describe("Array of request URLs/keys in the cache"),
  cacheName: z.string().describe("Name of the cache"),
  count: z.number().describe("Number of keys in the cache"),
});

// Get cache entry input/output
export const getCacheEntryInputSchema = z.object({
  cacheName: z.string().describe("Name of the cache"),
  key: z.string().describe("Request URL/key to retrieve"),
});

export const getCacheEntryOutputSchema = z.object({
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
});

// Set cache entry input/output
export const setCacheEntryInputSchema = z.object({
  cacheName: z.string().describe("Name of the cache (will be created if it doesn't exist)"),
  key: z.string().describe("Request URL/key"),
  response: z
    .object({
      status: z.number().optional().describe("HTTP status code"),
      statusText: z.string().optional().describe("HTTP status text"),
      headers: z.record(z.string(), z.string()).optional().describe("Response headers"),
      body: z.string().optional().describe("Response body as string"),
      url: z.string().optional().describe("Response URL"),
    })
    .describe("Response data to cache"),
});

export const setCacheEntryOutputSchema = z.object({
  success: z.boolean().describe("Whether the entry was set successfully"),
  cacheName: z.string().describe("Name of the cache"),
  key: z.string().describe("The key that was set"),
});

// Delete cache entry input/output
export const deleteCacheEntryInputSchema = z.object({
  cacheName: z.string().describe("Name of the cache"),
  key: z.string().describe("Request URL/key to delete"),
});

export const deleteCacheEntryOutputSchema = z.object({
  success: z.boolean().describe("Whether the entry was deleted successfully"),
  cacheName: z.string().describe("Name of the cache"),
  key: z.string().describe("The key that was deleted"),
});

// Delete cache input/output
export const deleteCacheInputSchema = z.object({
  cacheName: z.string().describe("Name of the cache to delete"),
});

export const deleteCacheOutputSchema = z.object({
  success: z.boolean().describe("Whether the cache was deleted successfully"),
  cacheName: z.string().describe("Name of the cache that was deleted"),
});

// Clear cache input/output
export const clearCacheInputSchema = z.object({
  cacheName: z.string().describe("Name of the cache to clear"),
});

export const clearCacheOutputSchema = z.object({
  success: z.boolean().describe("Whether the cache was cleared successfully"),
  cacheName: z.string().describe("Name of the cache"),
  deletedCount: z.number().describe("Number of entries deleted"),
});

// Adapters
export const listCachesAdapter: AdapterDefinition = {
  name: "list_caches",
  description: "List all available cache names",
  inputSchema: listCachesInputSchema,
  outputSchema: listCachesOutputSchema,
};

export const getCacheKeysAdapter: AdapterDefinition = {
  name: "get_cache_keys",
  description: "Get all keys in a specific cache",
  inputSchema: getCacheKeysInputSchema,
  outputSchema: getCacheKeysOutputSchema,
};

export const getCacheEntryAdapter: AdapterDefinition = {
  name: "get_cache_entry",
  description: "Get a specific cache entry by key",
  inputSchema: getCacheEntryInputSchema,
  outputSchema: getCacheEntryOutputSchema,
};

export const setCacheEntryAdapter: AdapterDefinition = {
  name: "set_cache_entry",
  description: "Set/add a cache entry",
  inputSchema: setCacheEntryInputSchema,
  outputSchema: setCacheEntryOutputSchema,
};

export const deleteCacheEntryAdapter: AdapterDefinition = {
  name: "delete_cache_entry",
  description: "Delete a specific cache entry by key",
  inputSchema: deleteCacheEntryInputSchema,
  outputSchema: deleteCacheEntryOutputSchema,
};

export const deleteCacheAdapter: AdapterDefinition = {
  name: "delete_cache",
  description: "Delete an entire cache",
  inputSchema: deleteCacheInputSchema,
  outputSchema: deleteCacheOutputSchema,
};

export const clearCacheAdapter: AdapterDefinition = {
  name: "clear_cache",
  description: "Clear all entries in a cache",
  inputSchema: clearCacheInputSchema,
  outputSchema: clearCacheOutputSchema,
};

