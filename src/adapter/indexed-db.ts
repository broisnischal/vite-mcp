import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

// List databases input/output
export const listIndexedDBDatabasesInputSchema = z.object({});

export const listIndexedDBDatabasesOutputSchema = z.object({
  databases: z
    .array(
      z.object({
        name: z.string().describe("Database name"),
        version: z.number().describe("Database version"),
      })
    )
    .describe("Array of IndexedDB databases"),
  count: z.number().describe("Number of databases"),
});

// Get database info input/output
export const getIndexedDBDatabaseInfoInputSchema = z.object({
  databaseName: z.string().describe("Name of the database"),
});

export const getIndexedDBDatabaseInfoOutputSchema = z.object({
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
});

// Get object store keys input/output
export const getIndexedDBKeysInputSchema = z.object({
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
});

export const getIndexedDBKeysOutputSchema = z.object({
  keys: z.array(z.any()).describe("Array of keys in the object store"),
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
  count: z.number().describe("Number of keys"),
});

// Get IndexedDB entry input/output
export const getIndexedDBEntryInputSchema = z.object({
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
  key: z.any().describe("Key to retrieve"),
});

export const getIndexedDBEntryOutputSchema = z.object({
  found: z.boolean().describe("Whether the entry was found"),
  key: z.any().describe("The key that was requested"),
  value: z.any().nullable().describe("The value or null if not found"),
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
});

// Set IndexedDB entry input/output
export const setIndexedDBEntryInputSchema = z.object({
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
  key: z.any().optional().describe("Key (optional if auto-increment)"),
  value: z.any().describe("Value to store"),
});

export const setIndexedDBEntryOutputSchema = z.object({
  success: z.boolean().describe("Whether the entry was set successfully"),
  key: z.any().describe("The key that was set"),
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
});

// Delete IndexedDB entry input/output
export const deleteIndexedDBEntryInputSchema = z.object({
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
  key: z.any().describe("Key to delete"),
});

export const deleteIndexedDBEntryOutputSchema = z.object({
  success: z.boolean().describe("Whether the entry was deleted successfully"),
  key: z.any().describe("The key that was deleted"),
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
});

// Clear object store input/output
export const clearIndexedDBObjectStoreInputSchema = z.object({
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
});

export const clearIndexedDBObjectStoreOutputSchema = z.object({
  success: z.boolean().describe("Whether the object store was cleared successfully"),
  databaseName: z.string().describe("Name of the database"),
  objectStoreName: z.string().describe("Name of the object store"),
  deletedCount: z.number().optional().describe("Number of entries deleted (if available)"),
});

// Delete database input/output
export const deleteIndexedDBDatabaseInputSchema = z.object({
  databaseName: z.string().describe("Name of the database to delete"),
});

export const deleteIndexedDBDatabaseOutputSchema = z.object({
  success: z.boolean().describe("Whether the database was deleted successfully"),
  databaseName: z.string().describe("Name of the database that was deleted"),
});

// Adapters
export const listIndexedDBDatabasesAdapter: AdapterDefinition = {
  name: "list_indexed_db_databases",
  description: "List all IndexedDB databases",
  inputSchema: listIndexedDBDatabasesInputSchema,
  outputSchema: listIndexedDBDatabasesOutputSchema,
};

export const getIndexedDBDatabaseInfoAdapter: AdapterDefinition = {
  name: "get_indexed_db_database_info",
  description: "Get information about a specific IndexedDB database",
  inputSchema: getIndexedDBDatabaseInfoInputSchema,
  outputSchema: getIndexedDBDatabaseInfoOutputSchema,
};

export const getIndexedDBKeysAdapter: AdapterDefinition = {
  name: "get_indexed_db_keys",
  description: "Get all keys in an IndexedDB object store",
  inputSchema: getIndexedDBKeysInputSchema,
  outputSchema: getIndexedDBKeysOutputSchema,
};

export const getIndexedDBEntryAdapter: AdapterDefinition = {
  name: "get_indexed_db_entry",
  description: "Get a specific IndexedDB entry by key",
  inputSchema: getIndexedDBEntryInputSchema,
  outputSchema: getIndexedDBEntryOutputSchema,
};

export const setIndexedDBEntryAdapter: AdapterDefinition = {
  name: "set_indexed_db_entry",
  description: "Set/add an IndexedDB entry",
  inputSchema: setIndexedDBEntryInputSchema,
  outputSchema: setIndexedDBEntryOutputSchema,
};

export const deleteIndexedDBEntryAdapter: AdapterDefinition = {
  name: "delete_indexed_db_entry",
  description: "Delete a specific IndexedDB entry by key",
  inputSchema: deleteIndexedDBEntryInputSchema,
  outputSchema: deleteIndexedDBEntryOutputSchema,
};

export const clearIndexedDBObjectStoreAdapter: AdapterDefinition = {
  name: "clear_indexed_db_object_store",
  description: "Clear all entries in an IndexedDB object store",
  inputSchema: clearIndexedDBObjectStoreInputSchema,
  outputSchema: clearIndexedDBObjectStoreOutputSchema,
};

export const deleteIndexedDBDatabaseAdapter: AdapterDefinition = {
  name: "delete_indexed_db_database",
  description: "Delete an entire IndexedDB database",
  inputSchema: deleteIndexedDBDatabaseInputSchema,
  outputSchema: deleteIndexedDBDatabaseOutputSchema,
};

