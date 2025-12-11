import { z } from "zod";
import type { AdapterDefinition } from "./types.js";

export const sessionAdapterInputSchema = z.object({});

export const sessionAdapterOutputSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().describe("Storage key"),
        value: z.string().describe("Storage value"),
      })
    )
    .describe("Array of sessionStorage items"),
});

export const sessionAdapter: AdapterDefinition = {
  name: "read_session_storage",
  description: "Read sessionStorage items from the browser",
  inputSchema: sessionAdapterInputSchema,
  outputSchema: sessionAdapterOutputSchema,
};
