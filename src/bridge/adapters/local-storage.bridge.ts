import type { AdapterBridge } from "../types.js";

export class LocalStorageBridge implements AdapterBridge {
  async execute(params: {
    action: "read" | "get" | "set" | "edit" | "remove" | "clear";
    key?: string;
    value?: string;
  }): Promise<unknown> {
    const action = params?.action;
    if (!action) {
      throw new Error(`Missing required parameter 'action' for local_storage adapter. Received params: ${JSON.stringify(params)}`);
    }

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
        return {
          action: "read",
          items,
          totalSize,
          itemCount: items.length,
        };
      }
      case "get": {
        const value = localStorage.getItem(params.key!);
        return {
          action: "get",
          value: value,
          key: params.key,
          size: value ? new Blob([value]).size : 0,
        };
      }
      case "set": {
        localStorage.setItem(params.key!, params.value!);
        return {
          action: "set",
          success: true,
          key: params.key,
          value: params.value,
          size: new Blob([params.value!]).size,
        };
      }
      case "edit": {
        localStorage.setItem(params.key!, params.value!);
        return {
          action: "edit",
          success: true,
          key: params.key,
          value: params.value,
          size: new Blob([params.value!]).size,
        };
      }
      case "remove": {
        const existed = localStorage.getItem(params.key!) !== null;
        localStorage.removeItem(params.key!);
        return {
          action: "remove",
          success: existed,
          key: params.key,
        };
      }
      case "clear": {
        const count = localStorage.length;
        localStorage.clear();
        return {
          action: "clear",
          success: true,
          itemCount: count,
        };
      }
      default:
        throw new Error(`Unknown localStorage action: ${action}`);
    }
  }
}

