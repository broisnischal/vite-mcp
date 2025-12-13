import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

const indexedDBAdapterOutputSchema = z.object({
  action: z.enum(["list_databases", "get_database_info", "get_keys", "get_entry", "set_entry", "delete_entry", "clear_object_store", "delete_database"]).describe("The action that was performed"),
  success: z.boolean().optional().describe("Whether the action was successful"),
  databases: z
    .array(
      z.object({
        name: z.string().describe("Database name"),
        version: z.number().describe("Database version"),
      })
    )
    .optional()
    .describe("Array of IndexedDB databases (for list_databases action)"),
  count: z.number().optional().describe("Number of databases or keys"),
  name: z.string().optional().describe("Database name (for get_database_info action)"),
  version: z.number().optional().describe("Database version (for get_database_info action)"),
  objectStores: z
    .array(
      z.object({
        name: z.string().describe("Object store name"),
        keyPath: z.string().nullable().describe("Key path"),
        autoIncrement: z.boolean().describe("Whether auto-increment is enabled"),
      })
    )
    .optional()
    .describe("Array of object stores (for get_database_info action)"),
  found: z.boolean().optional().describe("Whether the database or entry was found"),
  keys: z.array(z.any()).optional().describe("Array of keys in the object store (for get_keys action)"),
  databaseName: z.string().optional().describe("Name of the database"),
  objectStoreName: z.string().optional().describe("Name of the object store"),
  key: z.any().optional().describe("The key that was used"),
  value: z.any().nullable().optional().describe("The value (for get_entry action)"),
  deletedCount: z.number().optional().describe("Number of entries deleted (for clear_object_store action)"),
});

export const indexedDBAdapter: AdapterDefinition = {
  name: "indexed_db",
  description:
    "Manage IndexedDB: list databases, get database info, get keys, get/set/delete entries, clear object store, or delete database",
  inputSchema: indexedDBAdapterInputSchema,
  outputSchema: indexedDBAdapterOutputSchema,
  handler: async function (params?: {
    action?: "list_databases" | "get_database_info" | "get_keys" | "get_entry" | "set_entry" | "delete_entry" | "clear_object_store" | "delete_database";
    databaseName?: string;
    objectStoreName?: string;
    key?: unknown;
    value?: unknown;
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
        throw new Error(`Missing required parameter 'action' for indexed_db adapter. Received params: ${JSON.stringify(params)}`);
      }

      let result: unknown;

      switch (action) {
        case "list_databases": {
          if (!("indexedDB" in window)) {
            result = {
              action: "list_databases",
              databases: [],
              count: 0,
            };
            break;
          }
          result = {
            action: "list_databases",
            databases: [],
            count: 0,
          };
          break;
        }
        case "get_database_info": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          const databaseName = params.databaseName;
          if (!databaseName) {
            throw new Error("databaseName is required for get_database_info action");
          }
          result = await new Promise((resolve) => {
            const request = indexedDB.open(databaseName);
            request.onsuccess = () => {
              const db = request.result;
              const objectStores: Array<{ name: string; keyPath: string | null; autoIncrement: boolean }> = [];
              if (db.objectStoreNames) {
                for (let i = 0; i < db.objectStoreNames.length; i++) {
                  const storeName = db.objectStoreNames[i] as string;
                  const transaction = db.transaction([storeName], "readonly");
                  const store = transaction.objectStore(storeName);
                  objectStores.push({
                    name: storeName,
                    keyPath: store.keyPath as string | null,
                    autoIncrement: store.autoIncrement,
                  });
                }
              }
              db.close();
              resolve({
                action: "get_database_info",
                name: databaseName,
                version: db.version,
                objectStores,
                found: true,
              });
            };
            request.onerror = () => {
              resolve({
                action: "get_database_info",
                name: databaseName,
                version: 0,
                objectStores: [],
                found: false,
              });
            };
          });
          break;
        }
        case "get_keys": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          result = await new Promise((resolve, reject) => {
            const request = indexedDB.open(params.databaseName!);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([params.objectStoreName!], "readonly");
              const store = transaction.objectStore(params.objectStoreName!);
              const getAllKeysRequest = store.getAllKeys();
              getAllKeysRequest.onsuccess = () => {
                db.close();
                resolve({
                  action: "get_keys",
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
          break;
        }
        case "get_entry": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          if (!params.key) {
            throw new Error("Key is required for get_entry action");
          }
          result = await new Promise((resolve, reject) => {
            const request = indexedDB.open(params.databaseName!);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([params.objectStoreName!], "readonly");
              const store = transaction.objectStore(params.objectStoreName!);
              const getRequest = store.get(params.key as IDBValidKey);
              getRequest.onsuccess = () => {
                db.close();
                resolve({
                  action: "get_entry",
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
          break;
        }
        case "set_entry": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          if (params.key === undefined) {
            throw new Error("Key is required for set_entry action");
          }
          result = await new Promise((resolve, reject) => {
            const request = indexedDB.open(params.databaseName!);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([params.objectStoreName!], "readwrite");
              const store = transaction.objectStore(params.objectStoreName!);
              const putRequest = store.put(params.value, params.key as IDBValidKey);
              putRequest.onsuccess = () => {
                db.close();
                resolve({
                  action: "set_entry",
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
          break;
        }
        case "delete_entry": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          if (params.key === undefined) {
            throw new Error("Key is required for delete_entry action");
          }
          result = await new Promise((resolve, reject) => {
            const request = indexedDB.open(params.databaseName!);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([params.objectStoreName!], "readwrite");
              const store = transaction.objectStore(params.objectStoreName!);
              const deleteRequest = store.delete(params.key as IDBValidKey);
              deleteRequest.onsuccess = () => {
                db.close();
                resolve({
                  action: "delete_entry",
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
          break;
        }
        case "clear_object_store": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          result = await new Promise((resolve, reject) => {
            const request = indexedDB.open(params.databaseName!);
            request.onsuccess = () => {
              const db = request.result;
              const transaction = db.transaction([params.objectStoreName!], "readwrite");
              const store = transaction.objectStore(params.objectStoreName!);
              const clearRequest = store.clear();
              clearRequest.onsuccess = () => {
                db.close();
                resolve({
                  action: "clear_object_store",
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
          break;
        }
        case "delete_database": {
          if (!("indexedDB" in window)) {
            throw new Error("IndexedDB is not available");
          }
          result = await new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(params.databaseName!);
            deleteRequest.onsuccess = () => {
              resolve({
                action: "delete_database",
                success: true,
                databaseName: params.databaseName,
              });
            };
            deleteRequest.onerror = () => {
              reject(new Error("Failed to delete database"));
            };
          });
          break;
        }
        default:
          throw new Error(`Unknown indexedDB action: ${action}`);
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

