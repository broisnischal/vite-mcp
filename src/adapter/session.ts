import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

// Read sessionStorage input/output
export const readSessionStorageInputSchema = z.object({});

export const readSessionStorageOutputSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().describe("Storage key"),
        value: z.string().describe("Storage value"),
        size: z.number().optional().describe("Size in bytes"),
      })
    )
    .describe("Array of sessionStorage items"),
  totalSize: z.number().optional().describe("Total size of all items in bytes"),
  itemCount: z.number().describe("Number of items in sessionStorage"),
});

// Get sessionStorage item input/output
export const getSessionStorageInputSchema = z.object({
  key: z.string().describe("Storage key to retrieve"),
});

export const getSessionStorageOutputSchema = z.object({
  value: z.string().nullable().describe("Storage value or null if not found"),
  key: z.string().describe("The key that was requested"),
  size: z.number().optional().describe("Size in bytes"),
});

// Set sessionStorage item input/output
export const setSessionStorageInputSchema = z.object({
  key: z.string().describe("Storage key"),
  value: z.string().describe("Storage value"),
});

export const setSessionStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether the item was set successfully"),
  key: z.string().describe("The key that was set"),
  value: z.string().describe("The value that was set"),
  size: z.number().optional().describe("Size in bytes"),
});

// Edit sessionStorage item input/output (alias for set)
export const editSessionStorageInputSchema = z.object({
  key: z.string().describe("Storage key to edit"),
  value: z.string().describe("New storage value"),
});

export const editSessionStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether the item was edited successfully"),
  key: z.string().describe("The key that was edited"),
  value: z.string().describe("The new value"),
  size: z.number().optional().describe("Size in bytes"),
});

// Remove sessionStorage item input/output
export const removeSessionStorageInputSchema = z.object({
  key: z.string().describe("Storage key to remove"),
});

export const removeSessionStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether the item was removed successfully"),
  key: z.string().describe("The key that was removed"),
});

// Clear all sessionStorage input/output
export const clearSessionStorageInputSchema = z.object({});

export const clearSessionStorageOutputSchema = z.object({
  success: z.boolean().describe("Whether sessionStorage was cleared successfully"),
  itemCount: z.number().describe("Number of items that were cleared"),
});

// Legacy adapter (read only)
export const sessionAdapter: AdapterDefinition = {
  name: "read_session_storage",
  description: "Read all sessionStorage items from the browser",
  inputSchema: readSessionStorageInputSchema,
  outputSchema: readSessionStorageOutputSchema,
};

// CRUD adapters
export const getSessionStorageAdapter: AdapterDefinition = {
  name: "get_session_storage",
  description: "Get a specific sessionStorage item by key",
  inputSchema: getSessionStorageInputSchema,
  outputSchema: getSessionStorageOutputSchema,
};

export const setSessionStorageAdapter: AdapterDefinition = {
  name: "set_session_storage",
  description: "Set a sessionStorage item",
  inputSchema: setSessionStorageInputSchema,
  outputSchema: setSessionStorageOutputSchema,
};

export const editSessionStorageAdapter: AdapterDefinition = {
  name: "edit_session_storage",
  description: "Edit an existing sessionStorage item (same as set)",
  inputSchema: editSessionStorageInputSchema,
  outputSchema: editSessionStorageOutputSchema,
};

export const removeSessionStorageAdapter: AdapterDefinition = {
  name: "remove_session_storage",
  description: "Remove a sessionStorage item by key",
  inputSchema: removeSessionStorageInputSchema,
  outputSchema: removeSessionStorageOutputSchema,
};

export const clearSessionStorageAdapter: AdapterDefinition = {
  name: "clear_session_storage",
  description: "Clear all sessionStorage items",
  inputSchema: clearSessionStorageInputSchema,
  outputSchema: clearSessionStorageOutputSchema,
};

// Export schemas for backward compatibility
export const sessionAdapterInputSchema = readSessionStorageInputSchema;
export const sessionAdapterOutputSchema = readSessionStorageOutputSchema;
