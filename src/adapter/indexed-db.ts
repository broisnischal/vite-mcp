import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

const indexedDBAdapterInputSchema = z.object({
  action: z.union([
    z.literal("list_databases"),
    z.literal("get_database_info"),
    z.literal("get_keys"),
    z.literal("get_entry"),
    z.literal("set_entry"),
    z.literal("delete_entry"),
    z.literal("clear_object_store"),
    z.literal("delete_database"),
  ]).describe("Action to perform"),
  databaseName: z.string().optional().describe("Name of the database (required for most actions)"),
  objectStoreName: z.string().optional().describe("Name of the object store (required for many actions)"),
  key: z.any().optional().describe("Key (required for get_entry, set_entry, delete_entry)"),
  value: z.any().optional().describe("Value to store (required for set_entry)"),
});

const indexedDBAdapterOutputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list_databases"),
    databases: z
      .array(
        z.object({
          name: z.string().describe("Database name"),
          version: z.number().describe("Database version"),
        })
      )
      .describe("Array of IndexedDB databases"),
    count: z.number().describe("Number of databases"),
  }),
  z.object({
    action: z.literal("get_database_info"),
    name: z.string().describe("Database name"),
    version: z.number().describe("Database version"),
    objectStores: z
      .array(
        z.object({
          name: z.string().describe("Object store name"),
          keyPath: z.string().nullable().describe("Key path"),
          autoIncrement: z.boolean().describe("Whether auto-increment is enabled"),
        })
      )
      .describe("Array of object stores"),
    found: z.boolean().describe("Whether the database was found"),
  }),
  z.object({
    action: z.literal("get_keys"),
    keys: z.array(z.any()).describe("Array of keys in the object store"),
    databaseName: z.string().describe("Name of the database"),
    objectStoreName: z.string().describe("Name of the object store"),
    count: z.number().describe("Number of keys"),
  }),
  z.object({
    action: z.literal("get_entry"),
    found: z.boolean().describe("Whether the entry was found"),
    key: z.any().describe("The key that was requested"),
    value: z.any().nullable().describe("The value or null if not found"),
    databaseName: z.string().describe("Name of the database"),
    objectStoreName: z.string().describe("Name of the object store"),
  }),
  z.object({
    action: z.literal("set_entry"),
    success: z.boolean().describe("Whether the entry was set successfully"),
    key: z.any().describe("The key that was set"),
    databaseName: z.string().describe("Name of the database"),
    objectStoreName: z.string().describe("Name of the object store"),
  }),
  z.object({
    action: z.literal("delete_entry"),
    success: z.boolean().describe("Whether the entry was deleted successfully"),
    key: z.any().describe("The key that was deleted"),
    databaseName: z.string().describe("Name of the database"),
    objectStoreName: z.string().describe("Name of the object store"),
  }),
  z.object({
    action: z.literal("clear_object_store"),
    success: z.boolean().describe("Whether the object store was cleared successfully"),
    databaseName: z.string().describe("Name of the database"),
    objectStoreName: z.string().describe("Name of the object store"),
    deletedCount: z.number().optional().describe("Number of entries deleted (if available)"),
  }),
  z.object({
    action: z.literal("delete_database"),
    success: z.boolean().describe("Whether the database was deleted successfully"),
    databaseName: z.string().describe("Name of the database that was deleted"),
  }),
]);

export const indexedDBAdapter: AdapterDefinition = {
  name: "indexed_db",
  description:
    "Manage IndexedDB: list databases, get database info, get keys, get/set/delete entries, clear object store, or delete database",
  inputSchema: indexedDBAdapterInputSchema,
  outputSchema: indexedDBAdapterOutputSchema,
};

