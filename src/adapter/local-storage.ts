import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

const localStorageAdapterOutputSchema = z.object({
  action: z.enum(["read", "get", "set", "edit", "remove", "clear"]).describe("The action that was performed"),
  success: z.boolean().optional().describe("Whether the action was successful"),
  items: z
    .array(
      z.object({
        key: z.string().describe("Storage key"),
        value: z.string().describe("Storage value"),
        size: z.number().optional().describe("Size in bytes"),
      })
    )
    .optional()
    .describe("Array of localStorage items (for read action)"),
  totalSize: z.number().optional().describe("Total size of all items in bytes (for read action)"),
  itemCount: z.number().optional().describe("Number of items (for read and clear actions)"),
  value: z.string().nullable().optional().describe("Storage value (for get action)"),
  key: z.string().optional().describe("The key that was used"),
  size: z.number().optional().describe("Size in bytes (for get, set, edit actions)"),
});

export const localStorageAdapter: AdapterDefinition = {
  name: "local_storage",
  description: "Manage localStorage: read all, get by key, set, edit, remove, or clear all items",
  inputSchema: localStorageAdapterInputSchema,
  outputSchema: localStorageAdapterOutputSchema,
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
        throw new Error(`Missing required parameter 'action' for local_storage adapter. Received params: ${JSON.stringify(params)}`);
      }

      let result: unknown;

      switch (action) {
        case "read": {
          const items = Object.keys(localStorage).map((key) => {
            const value = localStorage.getItem(key) ?? "";
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
          const value = localStorage.getItem(params.key!);
          result = {
            action: "get",
            value: value,
            key: params.key,
            size: value ? new Blob([value]).size : 0,
          };
          break;
        }
        case "set": {
          localStorage.setItem(params.key!, params.value!);
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
          localStorage.setItem(params.key!, params.value!);
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
          const existed = localStorage.getItem(params.key!) !== null;
          localStorage.removeItem(params.key!);
          result = {
            action: "remove",
            success: existed,
            key: params.key,
          };
          break;
        }
        case "clear": {
          const count = localStorage.length;
          localStorage.clear();
          result = {
            action: "clear",
            success: true,
            itemCount: count,
          };
          break;
        }
        default:
          throw new Error(`Unknown localStorage action: ${action}`);
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
