import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

const localStorageAdapterInputSchema = z.object({
  action: z.union([
    z.literal("read"),
    z.literal("get"),
    z.literal("set"),
    z.literal("edit"),
    z.literal("remove"),
    z.literal("clear"),
  ]).describe("Action to perform"),
  key: z.string().optional().describe("Storage key (required for get, set, edit, remove)"),
  value: z.string().optional().describe("Storage value (required for set, edit)"),
});

const localStorageAdapterOutputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
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
  }),
  z.object({
    action: z.literal("get"),
    value: z.string().nullable().describe("Storage value or null if not found"),
    key: z.string().describe("The key that was requested"),
    size: z.number().optional().describe("Size in bytes"),
  }),
  z.object({
    action: z.literal("set"),
    success: z.boolean().describe("Whether the item was set successfully"),
    key: z.string().describe("The key that was set"),
    value: z.string().describe("The value that was set"),
    size: z.number().optional().describe("Size in bytes"),
  }),
  z.object({
    action: z.literal("edit"),
    success: z.boolean().describe("Whether the item was edited successfully"),
    key: z.string().describe("The key that was edited"),
    value: z.string().describe("The new value"),
    size: z.number().optional().describe("Size in bytes"),
  }),
  z.object({
    action: z.literal("remove"),
    success: z.boolean().describe("Whether the item was removed successfully"),
    key: z.string().describe("The key that was removed"),
  }),
  z.object({
    action: z.literal("clear"),
    success: z.boolean().describe("Whether localStorage was cleared successfully"),
    itemCount: z.number().describe("Number of items that were cleared"),
  }),
]);

export const localStorageAdapter: AdapterDefinition = {
  name: "local_storage",
  description: "Manage localStorage: read all, get by key, set, edit, remove, or clear all items",
  inputSchema: localStorageAdapterInputSchema,
  outputSchema: localStorageAdapterOutputSchema,
};
