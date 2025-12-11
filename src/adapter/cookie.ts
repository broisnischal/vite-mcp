import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

export const cookieAdapterInputSchema = z.object({});

export const cookieAdapterOutputSchema = z.object({
  cookies: z
    .array(
      z.object({
        name: z.string().describe("Cookie name"),
        value: z.string().describe("Cookie value"),
        domain: z.string().optional().describe("Cookie domain"),
        path: z.string().optional().describe("Cookie path"),
      })
    )
    .describe("Array of cookies"),
});

export const cookieAdapter: AdapterDefinition = {
  name: "read_cookies",
  description: "Read cookies from the browser",
  inputSchema: cookieAdapterInputSchema,
  outputSchema: cookieAdapterOutputSchema,
};
