import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const cookieDetailSchema = z.object({
  name: z.string().describe("Cookie name"),
  value: z.string().describe("Cookie value"),
  domain: z.string().optional().describe("Cookie domain"),
  path: z.string().optional().describe("Cookie path"),
  expires: z.number().optional().describe("Expiration timestamp in milliseconds"),
  expiresDate: z.string().optional().describe("Expiration date as ISO string"),
  maxAge: z.number().optional().describe("Max age in seconds"),
  secure: z.boolean().optional().describe("Secure flag (HTTPS only)"),
  httpOnly: z.boolean().optional().describe("HttpOnly flag (not accessible via JavaScript)"),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("SameSite attribute"),
  hostOnly: z.boolean().optional().describe("Whether cookie is host-only"),
  session: z.boolean().optional().describe("Whether cookie is a session cookie"),
  size: z.number().optional().describe("Cookie size in bytes"),
});

const cookieAdapterInputSchema = z.object({
  action: z.union([
    z.literal("read"),
    z.literal("get"),
    z.literal("set"),
    z.literal("edit"),
    z.literal("remove"),
  ]).describe("Action to perform"),
  name: z.string().optional().describe("Cookie name (required for get, set, edit, remove)"),
  value: z.string().optional().describe("Cookie value (required for set, optional for edit)"),
  domain: z.string().optional().describe("Cookie domain"),
  path: z.string().optional().describe("Cookie path (default: '/')"),
  expires: z.number().optional().describe("Expiration timestamp in milliseconds"),
  maxAge: z.number().optional().describe("Max age in seconds"),
  secure: z.boolean().optional().describe("Secure flag (HTTPS only)"),
  httpOnly: z.boolean().optional().describe("HttpOnly flag (note: cannot be set via JavaScript)"),
  sameSite: z.union([
    z.literal("Strict"),
    z.literal("Lax"),
    z.literal("None"),
  ]).optional().describe("SameSite attribute"),
});

const cookieAdapterOutputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    cookies: z.array(cookieDetailSchema).describe("Array of detailed cookie information"),
  }),
  z.object({
    action: z.literal("get"),
    cookie: cookieDetailSchema.nullable().describe("Cookie details or null if not found"),
  }),
  z.object({
    action: z.literal("set"),
    success: z.boolean().describe("Whether the cookie was set successfully"),
    cookie: cookieDetailSchema.optional().describe("The cookie that was set"),
  }),
  z.object({
    action: z.literal("edit"),
    success: z.boolean().describe("Whether the cookie was edited successfully"),
    cookie: cookieDetailSchema.optional().describe("The updated cookie"),
  }),
  z.object({
    action: z.literal("remove"),
    success: z.boolean().describe("Whether the cookie was removed successfully"),
  }),
]);

interface CookieDetails {
  name: string;
  value: string;
  size: number;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string | undefined;
  hostOnly: boolean;
  session: boolean;
}

function getCookieDetails(name: string): CookieDetails | null {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName?.trim() === name) {
      const value = valueParts.join("=").trim();
      const details: CookieDetails = {
        name: name,
        value: value,
        size: (name + "=" + value).length,
        domain: window.location.hostname,
        path: "/",
        secure: window.location.protocol === "https:",
        httpOnly: false,
        hostOnly: true,
        session: true,
      };
      return details;
    }
  }
  return null;
}

function getAllCookiesWithDetails(): CookieDetails[] {
  const cookies: CookieDetails[] = [];
  const cookieString = document.cookie;

  if (!cookieString) {
    return cookies;
  }

  const cookieParts = cookieString.split(";");
  for (const cookie of cookieParts) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name) {
      const value = valueParts.join("=").trim();
      const cookieDetail: CookieDetails = {
        name: name.trim(),
        value: value,
        domain: window.location.hostname,
        path: "/",
        secure: window.location.protocol === "https:",
        httpOnly: false,
        hostOnly: true,
        session: true,
        size: (name.trim() + "=" + value).length,
      };
      cookies.push(cookieDetail);
    }
  }

  return cookies;
}

function setCookieWithOptions(
  name: string,
  value: string,
  options: {
    path?: string;
    domain?: string;
    expires?: number;
    maxAge?: number;
    secure?: boolean;
    sameSite?: string;
  } = {}
): CookieDetails | null {
  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.path) {
    cookieString += `; path=${options.path}`;
  } else {
    cookieString += `; path=/`;
  }

  if (options.domain) {
    cookieString += `; domain=${options.domain}`;
  }

  if (options.expires) {
    const expiresDate = new Date(options.expires);
    cookieString += `; expires=${expiresDate.toUTCString()}`;
  } else if (options.maxAge !== undefined) {
    cookieString += `; max-age=${options.maxAge}`;
  }

  if (options.secure) {
    cookieString += `; secure`;
  }

  if (options.sameSite) {
    cookieString += `; samesite=${options.sameSite}`;
  }

  document.cookie = cookieString;

  return getCookieDetails(name);
}

export const cookieAdapter: AdapterDefinition = {
  name: "cookie",
  description: "Manage cookies: read all, get by name, set, edit, or remove cookies",
  inputSchema: cookieAdapterInputSchema,
  outputSchema: cookieAdapterOutputSchema,
  handler: async function (params?: {
    action?: "read" | "get" | "set" | "edit" | "remove";
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: number;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
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
        throw new Error(`Missing required parameter 'action' for cookie adapter. Received params: ${JSON.stringify(params)}`);
      }

      let result: unknown;

      switch (action) {
        case "read": {
          result = {
            action: "read",
            cookies: getAllCookiesWithDetails(),
          };
          break;
        }
        case "get": {
          const cookie = getCookieDetails(params.name!);
          result = {
            action: "get",
            cookie: cookie,
          };
          break;
        }
        case "set": {
          const setOptions: {
            path?: string;
            domain?: string;
            expires?: number;
            maxAge?: number;
            secure?: boolean;
            sameSite?: string;
          } = {};

          if (params?.domain !== undefined) {
            setOptions.domain = params.domain;
          }
          if (params?.path !== undefined) {
            setOptions.path = params.path;
          }
          if (params?.expires !== undefined) {
            setOptions.expires = params.expires;
          }
          if (params?.maxAge !== undefined) {
            setOptions.maxAge = params.maxAge;
          }
          if (params?.secure !== undefined) {
            setOptions.secure = params.secure;
          }
          if (params?.sameSite !== undefined) {
            setOptions.sameSite = params.sameSite;
          }

          const cookie = setCookieWithOptions(params.name!, params.value!, setOptions);
          result = {
            action: "set",
            success: true,
            cookie: cookie,
          };
          break;
        }
        case "edit": {
          const existing = getCookieDetails(params.name!);
          if (!existing) {
            result = {
              action: "edit",
              success: false,
              cookie: null,
            };
            break;
          }
          const editOptions: {
            path?: string;
            domain?: string;
            expires?: number;
            maxAge?: number;
            secure?: boolean;
            sameSite?: string;
          } = {};

          if (params?.domain !== undefined) {
            editOptions.domain = params.domain;
          } else {
            editOptions.domain = existing.domain;
          }

          if (params?.path !== undefined) {
            editOptions.path = params.path;
          } else {
            editOptions.path = existing.path;
          }

          if (params?.expires !== undefined) {
            editOptions.expires = params.expires;
          }

          if (params?.maxAge !== undefined) {
            editOptions.maxAge = params.maxAge;
          }

          if (params?.secure !== undefined) {
            editOptions.secure = params.secure;
          } else {
            editOptions.secure = existing.secure;
          }

          if (params?.sameSite !== undefined) {
            editOptions.sameSite = params.sameSite;
          }

          const cookie = setCookieWithOptions(
            params.name!,
            params.value !== undefined ? params.value : existing.value,
            editOptions
          );
          result = {
            action: "edit",
            success: true,
            cookie: cookie,
          };
          break;
        }
        case "remove": {
          const cookieString = `${encodeURIComponent(params.name!)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${params.path || "/"}`;
          if (params.domain) {
            document.cookie = `${cookieString}; domain=${params.domain}`;
          } else {
            document.cookie = cookieString;
          }
          result = {
            action: "remove",
            success: true,
          };
          break;
        }
        default:
          throw new Error(`Unknown cookie action: ${action}`);
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
