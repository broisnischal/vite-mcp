import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getComponentTree } from "../bridge/utils/component-tree.js";

export const componentTreeAdapterInputSchema = z.object({
  framework: z
    .enum(["auto", "react", "vue", "svelte"])
    .optional()
    .default("auto")
    .describe("Framework to detect component tree from (auto-detect if not specified)"),
  maxDepth: z
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe("Maximum depth to traverse the component tree"),
  includeProps: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to include component props in the output"),
  includeState: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to include component state in the output"),
});

const componentTreeNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string().describe("Component name"),
    type: z.string().describe("Component type (functional, class, dom, etc.)"),
    props: z.record(z.string(), z.unknown()).optional().describe("Component props or DOM attributes"),
    state: z.unknown().optional().describe("Component state"),
    children: z.array(componentTreeNodeSchema).optional().describe("Child components"),
    key: z.string().optional().describe("React key or Vue key"),
    framework: z.string().optional().describe("Detected framework"),
    id: z.string().optional().describe("DOM element id"),
    className: z.string().optional().describe("DOM element class name"),
    text: z.string().optional().describe("Text content for text nodes"),
  }).passthrough()
);

export const componentTreeAdapterOutputSchema = z.object({
  tree: componentTreeNodeSchema.describe("Root component tree node"),
  framework: z.string().optional().describe("Detected framework"),
  componentCount: z.number().describe("Total number of components in the tree"),
});

export const componentTreeAdapter: AdapterDefinition = {
  name: "read_component_tree",
  description:
    "Display a live, interactive component tree for supported frameworks (React, Vue, etc) for better introspection and state tracing",
  inputSchema: componentTreeAdapterInputSchema,
  outputSchema: componentTreeAdapterOutputSchema,
  handler: async function (params?: {
    framework?: string;
    maxDepth?: number;
    includeProps?: boolean;
    includeState?: boolean;
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
      const framework = params?.framework || "auto";
      const maxDepth = params?.maxDepth || 10;
      const includeProps = params?.includeProps || false;
      const includeState = params?.includeState || false;
      const result = await getComponentTree(framework, maxDepth, includeProps, includeState);

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
