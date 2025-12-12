import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

// Read localStorage input/output
export const readLocalStorageInputSchema = z.object({});

export const readLocalStorageOutputSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().describe("Storage key"),
        value: z.string().describe("Storage value"),
        size: z.number().optional().describe("Size in bytes"),
      })
    )
    .describe("Array of localStorage items"),
  totalSize: z.number().optional().describe("Total size of all items in bytes"),
  itemCount: z.number().describe("Number of items in localStorage"),
});

// Get localStorage item input/output
export const getLocalStorageInputSchema = z.object({
  key: z.string().describe("Storage key to retrieve"),
});

export const getLocalStorageOutputSchema = z.object({
  value: z.string().nullable().describe("Storage value or null if not found"),
  key: z.string().describe("The key that was requested"),
  size: z.number().optional().describe("Size in bytes"),
});

// Set localStorage item input/output
export const setLocalStorageInputSchema = z.object({
  key: z.string().describe("Storage key"),
  value: z.string().describe("Storage value"),
});

export const setLocalStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether the item was set successfully"),
  key: z.string().describe("The key that was set"),
  value: z.string().describe("The value that was set"),
  size: z.number().optional().describe("Size in bytes"),
});

// Edit localStorage item input/output (alias for set)
export const editLocalStorageInputSchema = z.object({
  key: z.string().describe("Storage key to edit"),
  value: z.string().describe("New storage value"),
});

export const editLocalStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether the item was edited successfully"),
  key: z.string().describe("The key that was edited"),
  value: z.string().describe("The new value"),
  size: z.number().optional().describe("Size in bytes"),
});

// Remove localStorage item input/output
export const removeLocalStorageInputSchema = z.object({
  key: z.string().describe("Storage key to remove"),
});

export const removeLocalStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether the item was removed successfully"),
  key: z.string().describe("The key that was removed"),
});

// Clear all localStorage input/output
export const clearLocalStorageInputSchema = z.object({});

export const clearLocalStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether localStorage was cleared successfully"),
  itemCount: z.number().describe("Number of items that were cleared"),
});

// Legacy adapter (read only)
export const localStorageAdapter: AdapterDefinition = {
  name: "read_local_storage",
  description: "Read all localStorage items from the browser",
  inputSchema: readLocalStorageInputSchema,
  outputSchema: readLocalStorageOutputSchema,
};

// CRUD adapters
export const getLocalStorageAdapter: AdapterDefinition = {
  name: "get_local_storage",
  description: "Get a specific localStorage item by key",
  inputSchema: getLocalStorageInputSchema,
  outputSchema: getLocalStorageOutputSchema,
};

export const setLocalStorageAdapter: AdapterDefinition = {
  name: "set_local_storage",
  description: "Set a localStorage item",
  inputSchema: setLocalStorageInputSchema,
  outputSchema: setLocalStorageOutputSchema,
};

export const editLocalStorageAdapter: AdapterDefinition = {
  name: "edit_local_storage",
  description: "Edit an existing localStorage item (same as set)",
  inputSchema: editLocalStorageInputSchema,
  outputSchema: editLocalStorageOutputSchema,
};

export const removeLocalStorageAdapter: AdapterDefinition = {
  name: "remove_local_storage",
  description: "Remove a localStorage item by key",
  inputSchema: removeLocalStorageInputSchema,
  outputSchema: removeLocalStorageOutputSchema,
};

export const clearLocalStorageAdapter: AdapterDefinition = {
  name: "clear_local_storage",
  description: "Clear all localStorage items",
  inputSchema: clearLocalStorageInputSchema,
  outputSchema: clearLocalStorageOutputSchema,
};

// Export schemas for backward compatibility
export const localStorageAdapterInputSchema = readLocalStorageInputSchema;
export const localStorageAdapterOutputSchema = readLocalStorageOutputSchema;
