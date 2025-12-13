import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const sessionStorageAdapterInputSchema = z.object({
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

const sessionStorageAdapterOutputSchema = z.discriminatedUnion("action", [
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
      .describe("Array of sessionStorage items"),
    totalSize: z.number().optional().describe("Total size of all items in bytes"),
    itemCount: z.number().describe("Number of items in sessionStorage"),
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
    success: z.boolean().describe("Whether sessionStorage was cleared successfully"),
    itemCount: z.number().describe("Number of items that were cleared"),
  }),
]);

export const sessionStorageAdapter: AdapterDefinition = {
  name: "session_storage",
  description: "Manage sessionStorage: read all, get by key, set, edit, remove, or clear all items",
  inputSchema: sessionStorageAdapterInputSchema,
  outputSchema: sessionStorageAdapterOutputSchema,
  handler: async function (params?: {
    action?: "read" | "get" | "set" | "edit" | "remove" | "clear";
    key?: string;
    value?: string;
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
        throw new Error(`Missing required parameter 'action' for session_storage adapter. Received params: ${JSON.stringify(params)}`);
      }

      let result: unknown;

      switch (action) {
        case "read": {
          const items = Object.keys(sessionStorage).map((key) => {
            const value = sessionStorage.getItem(key) ?? "";
            return {
              key,
              value,
              size: new Blob([value]).size,
            };
          });
          const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
          result = {
            action: "read",
            items,
            totalSize,
            itemCount: items.length,
          };
          break;
        }
        case "get": {
          const value = sessionStorage.getItem(params.key!);
          result = {
            action: "get",
            value: value,
            key: params.key,
            size: value ? new Blob([value]).size : 0,
          };
          break;
        }
        case "set": {
          sessionStorage.setItem(params.key!, params.value!);
          result = {
            action: "set",
            success: true,
            key: params.key,
            value: params.value,
            size: new Blob([params.value!]).size,
          };
          break;
        }
        case "edit": {
          sessionStorage.setItem(params.key!, params.value!);
          result = {
            action: "edit",
            success: true,
            key: params.key,
            value: params.value,
            size: new Blob([params.value!]).size,
          };
          break;
        }
        case "remove": {
          const existed = sessionStorage.getItem(params.key!) !== null;
          sessionStorage.removeItem(params.key!);
          result = {
            action: "remove",
            success: existed,
            key: params.key,
          };
          break;
        }
        case "clear": {
          const count = sessionStorage.length;
          sessionStorage.clear();
          result = {
            action: "clear",
            success: true,
            itemCount: count,
          };
          break;
        }
        default:
          throw new Error(`Unknown sessionStorage action: ${action}`);
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
