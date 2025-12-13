import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

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

export const cookieAdapter: AdapterDefinition = {
  name: "cookie",
  description: "Manage cookies: read all, get by name, set, edit, or remove cookies",
  inputSchema: cookieAdapterInputSchema,
  outputSchema: cookieAdapterOutputSchema,
};
