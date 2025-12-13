import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getPerformanceMetrics } from "../bridge/utils/performance.js";

export const performanceMetricsAdapterInputSchema = z.object({
  includeResourceTimings: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include resource timing information"),
  includeNavigationTiming: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include navigation timing information"),
  includeWebVitals: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include Core Web Vitals metrics"),
  includePerformanceEntries: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to include all performance entries"),
});

const timingSchema = z.object({
  startTime: z.number().describe("Start time in milliseconds"),
  duration: z.number().describe("Duration in milliseconds"),
  name: z.string().optional().describe("Resource name or identifier"),
  entryType: z.string().optional().describe("Performance entry type"),
});

const webVitalsSchema = z.object({
  lcp: z
    .object({
      value: z.number().optional().describe("Largest Contentful Paint value in milliseconds"),
      rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    })
    .optional()
    .describe("Largest Contentful Paint metric"),
  fid: z
    .object({
      value: z.number().optional().describe("First Input Delay value in milliseconds"),
      rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    })
    .optional()
    .describe("First Input Delay metric"),
  cls: z
    .object({
      value: z.number().optional().describe("Cumulative Layout Shift value"),
      rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    })
    .optional()
    .describe("Cumulative Layout Shift metric"),
  fcp: z
    .object({
      value: z.number().optional().describe("First Contentful Paint value in milliseconds"),
      rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    })
    .optional()
    .describe("First Contentful Paint metric"),
  ttfb: z
    .object({
      value: z.number().optional().describe("Time to First Byte value in milliseconds"),
      rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    })
    .optional()
    .describe("Time to First Byte metric"),
});

const navigationTimingSchema = z.object({
  navigationStart: z.number().optional(),
  unloadEventStart: z.number().optional(),
  unloadEventEnd: z.number().optional(),
  redirectStart: z.number().optional(),
  redirectEnd: z.number().optional(),
  fetchStart: z.number().optional(),
  domainLookupStart: z.number().optional(),
  domainLookupEnd: z.number().optional(),
  connectStart: z.number().optional(),
  connectEnd: z.number().optional(),
  secureConnectionStart: z.number().optional(),
  requestStart: z.number().optional(),
  responseStart: z.number().optional(),
  responseEnd: z.number().optional(),
  domLoading: z.number().optional(),
  domInteractive: z.number().optional(),
  domContentLoadedEventStart: z.number().optional(),
  domContentLoadedEventEnd: z.number().optional(),
  domComplete: z.number().optional(),
  loadEventStart: z.number().optional(),
  loadEventEnd: z.number().optional(),
});

const resourceTimingSchema = z.object({
  resources: z
    .array(
      z.object({
        name: z.string().describe("Resource URL"),
        initiatorType: z.string().optional().describe("Resource type (script, link, img, etc.)"),
        duration: z.number().optional().describe("Total duration in milliseconds"),
        transferSize: z.number().optional().describe("Transfer size in bytes"),
        encodedBodySize: z.number().optional().describe("Encoded body size in bytes"),
        decodedBodySize: z.number().optional().describe("Decoded body size in bytes"),
        startTime: z.number().optional().describe("Start time relative to navigation start"),
        responseEnd: z.number().optional().describe("Response end time"),
      })
    )
    .optional()
    .describe("Resource timing entries"),
  totalTransferSize: z.number().optional().describe("Total transfer size of all resources"),
  totalEncodedSize: z.number().optional().describe("Total encoded size of all resources"),
  totalDecodedSize: z.number().optional().describe("Total decoded size of all resources"),
});

export const performanceMetricsAdapterOutputSchema = z.object({
  webVitals: webVitalsSchema.optional().describe("Core Web Vitals metrics"),
  navigationTiming: navigationTimingSchema.optional().describe("Navigation timing API data"),
  resourceTiming: resourceTimingSchema.optional().describe("Resource timing information"),
  performanceEntries: z
    .array(timingSchema)
    .optional()
    .describe("All performance entries if requested"),
  timestamp: z.number().describe("Timestamp when metrics were collected"),
  url: z.string().describe("Current page URL"),
});

export const performanceMetricsAdapter: AdapterDefinition = {
  name: "read_performance_metrics",
  description:
    "Display core web vitals, page load timings, and real user metrics for performance analysis",
  inputSchema: performanceMetricsAdapterInputSchema,
  outputSchema: performanceMetricsAdapterOutputSchema,
  handler: async function (params?: {
    includeResourceTimings?: boolean;
    includeNavigationTiming?: boolean;
    includeWebVitals?: boolean;
    includePerformanceEntries?: boolean;
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
      const result = await getPerformanceMetrics({
        includeResourceTimings: params?.includeResourceTimings !== false,
        includeNavigationTiming: params?.includeNavigationTiming !== false,
        includeWebVitals: params?.includeWebVitals !== false,
        includePerformanceEntries: params?.includePerformanceEntries === true,
      });

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

