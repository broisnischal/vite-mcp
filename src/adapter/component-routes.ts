// import { z } from "zod";
// import type { AdapterDefinition } from "./types.js";
// import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
// import { getComponentRoutes } from "../bridge/utils/component-routes.js";

// export const componentRoutesAdapterInputSchema = z.object({
//   framework: z
//     .enum(["auto", "react-router", "vue-router", "tanstack-router", "remix"])
//     .optional()
//     .default("auto")
//     .describe("Framework to detect routes from (auto-detect if not specified)"),
// });

// export const componentRoutesAdapterOutputSchema = z.object({
//   routes: z
//     .array(
//       z.object({
//         path: z.string().describe("Route path pattern"),
//         component: z.string().optional().describe("Component name or identifier"),
//         isActive: z.boolean().describe("Whether this route is currently active"),
//         params: z
//           .record(z.string(), z.string())
//           .optional()
//           .describe("Current route parameters"),
//         query: z
//           .record(z.string(), z.string())
//           .optional()
//           .describe("Current route query parameters"),
//         framework: z
//           .string()
//           .optional()
//           .describe("Detected framework for this route"),
//       })
//     )
//     .describe("Array of detected routes"),
//   currentRoute: z
//     .object({
//       path: z.string().describe("Current route path"),
//       component: z.string().optional().describe("Current component name"),
//       params: z.record(z.string(), z.string()).optional().describe("Current route parameters"),
//       query: z.record(z.string(), z.string()).optional().describe("Current route query parameters"),
//     })
//     .optional()
//     .describe("Currently active route information"),
//   framework: z
//     .string()
//     .optional()
//     .describe("Detected routing framework"),
// });

// export const componentRoutesAdapter: AdapterDefinition = {
//   name: "read_component_routes",
//   description:
//     "Visualize and inspect frontend routing, including mapping between components and their active routes",
//   inputSchema: componentRoutesAdapterInputSchema,
//   outputSchema: componentRoutesAdapterOutputSchema,
//   handler: async function (params?: { framework?: string }): Promise<CallToolResult> {
//     if (typeof window === "undefined") {
//       return {
//         content: [
//           {
//             type: "text" as const,
//             text: JSON.stringify({ error: "Not available in server environment" }),
//           },
//         ],
//         isError: true,
//       };
//     }

//     try {
//       const framework = params?.framework || "auto";
//       const result = await getComponentRoutes(framework);

//       return {
//         content: [
//           {
//             type: "text" as const,
//             text: JSON.stringify(result),
//           },
//         ],
//       };
//     } catch (error) {
//       return {
//         content: [
//           {
//             type: "text" as const,
//             text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
//           },
//         ], 
//         isError: true,
//       };
//     }
//   },
// };
