import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

// Detailed cookie schema with all properties
export const cookieDetailSchema = z.object({
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

// Read cookies input/output
export const readCookiesInputSchema = z.object({});

export const readCookiesOutputSchema = z.object({
  cookies: z.array(cookieDetailSchema).describe("Array of detailed cookie information"),
});

// Get cookie input/output
export const getCookieInputSchema = z.object({
  name: z.string().describe("Cookie name to retrieve"),
});

export const getCookieOutputSchema = z.object({
  cookie: cookieDetailSchema.nullable().describe("Cookie details or null if not found"),
});

// Set cookie input/output
export const setCookieInputSchema = z.object({
  name: z.string().describe("Cookie name"),
  value: z.string().describe("Cookie value"),
  domain: z.string().optional().describe("Cookie domain"),
  path: z.string().optional().describe("Cookie path (default: '/')"),
  expires: z.number().optional().describe("Expiration timestamp in milliseconds"),
  maxAge: z.number().optional().describe("Max age in seconds"),
  secure: z.boolean().optional().describe("Secure flag (HTTPS only)"),
  httpOnly: z.boolean().optional().describe("HttpOnly flag (note: cannot be set via JavaScript)"),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("SameSite attribute"),
});

export const setCookieOutputSchema = z.object({
  success: z.boolean().describe("Whether the cookie was set successfully"),
  cookie: cookieDetailSchema.optional().describe("The cookie that was set"),
});

// Edit cookie input/output (alias for set with partial update)
export const editCookieInputSchema = z.object({
  name: z.string().describe("Cookie name to edit"),
  value: z.string().optional().describe("New cookie value"),
  domain: z.string().optional().describe("New cookie domain"),
  path: z.string().optional().describe("New cookie path"),
  expires: z.number().optional().describe("New expiration timestamp in milliseconds"),
  maxAge: z.number().optional().describe("New max age in seconds"),
  secure: z.boolean().optional().describe("New secure flag"),
  httpOnly: z.boolean().optional().describe("New httpOnly flag (note: cannot be set via JavaScript)"),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional().describe("New sameSite attribute"),
});

export const editCookieOutputSchema = z.object({
  success: z.boolean().describe("Whether the cookie was edited successfully"),
  cookie: cookieDetailSchema.optional().describe("The updated cookie"),
});

// Remove cookie input/output
export const removeCookieInputSchema = z.object({
  name: z.string().describe("Cookie name to remove"),
  path: z.string().optional().describe("Cookie path (required if cookie was set with a specific path)"),
  domain: z.string().optional().describe("Cookie domain (required if cookie was set with a specific domain)"),
});

export const removeCookieOutputSchema = z.object({
  success: z.boolean().describe("Whether the cookie was removed successfully"),
});

// Legacy adapter (read only)
export const cookieAdapter: AdapterDefinition = {
  name: "read_cookies",
  description: "Read all cookies from the browser with detailed information",
  inputSchema: readCookiesInputSchema,
  outputSchema: readCookiesOutputSchema,
};

// Export schemas for backward compatibility
export const cookieAdapterInputSchema = readCookiesInputSchema;
export const cookieAdapterOutputSchema = readCookiesOutputSchema;

// CRUD adapters
export const getCookieAdapter: AdapterDefinition = {
  name: "get_cookie",
  description: "Get a specific cookie by name with detailed information",
  inputSchema: getCookieInputSchema,
  outputSchema: getCookieOutputSchema,
};

export const setCookieAdapter: AdapterDefinition = {
  name: "set_cookie",
  description: "Set a cookie with detailed options",
  inputSchema: setCookieInputSchema,
  outputSchema: setCookieOutputSchema,
};

export const editCookieAdapter: AdapterDefinition = {
  name: "edit_cookie",
  description: "Edit an existing cookie (partial update)",
  inputSchema: editCookieInputSchema,
  outputSchema: editCookieOutputSchema,
};

export const removeCookieAdapter: AdapterDefinition = {
  name: "remove_cookie",
  description: "Remove a cookie by name",
  inputSchema: removeCookieInputSchema,
  outputSchema: removeCookieOutputSchema,
};
