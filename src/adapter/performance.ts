import { z } from "zod";
import type { AdapterDefinition } from "./types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const performanceAdapterInputSchema = z.object({
    includeResourceTimings: z.boolean().optional().default(true).describe("Include resource timing data"),
    includeNavigationTiming: z.boolean().optional().default(true).describe("Include navigation timing data"),
    includeWebVitals: z.boolean().optional().default(true).describe("Include Web Vitals metrics (LCP, FID, CLS, etc.)"),
    includePerformanceEntries: z.boolean().optional().default(false).describe("Include all performance entries"),
});

interface NavigationTimingData {
    navigationStart: number;
    unloadEventStart: number;
    unloadEventEnd: number;
    redirectStart: number;
    redirectEnd: number;
    fetchStart: number;
    domainLookupStart: number;
    domainLookupEnd: number;
    connectStart: number;
    connectEnd: number;
    secureConnectionStart: number;
    requestStart: number;
    responseStart: number;
    responseEnd: number;
    domLoading: number;
    domInteractive: number;
    domContentLoadedEventStart: number;
    domContentLoadedEventEnd: number;
    domComplete: number;
    loadEventStart: number;
    loadEventEnd: number;
}

interface ResourceTimingData {
    name: string;
    startTime: number;
    duration: number;
    initiatorType: string;
    transferSize: number;
    encodedBodySize: number;
    decodedBodySize: number;
    nextHopProtocol: string;
    renderBlockingStatus?: string;
}

interface WebVitalsData {
    LCP?: number;
    FID?: number;
    CLS?: number;
    FCP?: number;
    TTFB?: number;
    INP?: number;
}

interface PerformanceEntryData {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
    [key: string]: unknown;
}

export const performanceAdapterOutputSchema = z.object({
    navigationTiming: z
        .object({
            navigationStart: z.number(),
            unloadEventStart: z.number(),
            unloadEventEnd: z.number(),
            redirectStart: z.number(),
            redirectEnd: z.number(),
            fetchStart: z.number(),
            domainLookupStart: z.number(),
            domainLookupEnd: z.number(),
            connectStart: z.number(),
            connectEnd: z.number(),
            secureConnectionStart: z.number(),
            requestStart: z.number(),
            responseStart: z.number(),
            responseEnd: z.number(),
            domLoading: z.number(),
            domInteractive: z.number(),
            domContentLoadedEventStart: z.number(),
            domContentLoadedEventEnd: z.number(),
            domComplete: z.number(),
            loadEventStart: z.number(),
            loadEventEnd: z.number(),
        })
        .optional(),
    resourceTimings: z.array(
        z.object({
            name: z.string(),
            startTime: z.number(),
            duration: z.number(),
            initiatorType: z.string(),
            transferSize: z.number(),
            encodedBodySize: z.number(),
            decodedBodySize: z.number(),
            nextHopProtocol: z.string(),
            renderBlockingStatus: z.string().optional(),
        })
    ).optional(),
    webVitals: z
        .object({
            LCP: z.number().optional(),
            FID: z.number().optional(),
            CLS: z.number().optional(),
            FCP: z.number().optional(),
            TTFB: z.number().optional(),
            INP: z.number().optional(),
        })
        .optional(),
    performanceEntries: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const performanceAdapter: AdapterDefinition = {
    name: "performance",
    description: "Get performance metrics including navigation timing, resource timings, Web Vitals (LCP, FID, CLS, etc.), and performance entries",
    inputSchema: performanceAdapterInputSchema,
    outputSchema: performanceAdapterOutputSchema,
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
                        text: "Performance metrics are not available in server environment",
                    },
                ],
                isError: true,
            };
        }

        const getNavigationTimingLocal = (): NavigationTimingData | undefined => {
            if (typeof window === "undefined" || !window.performance) {
                return undefined;
            }

            try {
                const navTiming = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

                if (!navTiming) {
                    return undefined;
                }

                const navigationStart = window.performance.timeOrigin ?? 0;

                return {
                    navigationStart,
                    unloadEventStart: navTiming.unloadEventStart,
                    unloadEventEnd: navTiming.unloadEventEnd,
                    redirectStart: navTiming.redirectStart,
                    redirectEnd: navTiming.redirectEnd,
                    fetchStart: navTiming.fetchStart,
                    domainLookupStart: navTiming.domainLookupStart,
                    domainLookupEnd: navTiming.domainLookupEnd,
                    connectStart: navTiming.connectStart,
                    connectEnd: navTiming.connectEnd,
                    secureConnectionStart: navTiming.secureConnectionStart,
                    requestStart: navTiming.requestStart,
                    responseStart: navTiming.responseStart,
                    responseEnd: navTiming.responseEnd,
                    domLoading: (navTiming as any).domLoading ?? 0,
                    domInteractive: navTiming.domInteractive,
                    domContentLoadedEventStart: navTiming.domContentLoadedEventStart,
                    domContentLoadedEventEnd: navTiming.domContentLoadedEventEnd,
                    domComplete: navTiming.domComplete,
                    loadEventStart: navTiming.loadEventStart,
                    loadEventEnd: navTiming.loadEventEnd,
                };
            } catch (error) {
                console.error("[MCP] Error getting navigation timing:", error);
                return undefined;
            }
        };

        const getResourceTimingsLocal = (): ResourceTimingData[] => {
            if (typeof window === "undefined" || !window.performance) {
                return [];
            }

            try {
                const resources = window.performance.getEntriesByType("resource") as PerformanceResourceTiming[];
                return resources.map((entry) => ({
                    name: entry.name,
                    startTime: entry.startTime,
                    duration: entry.duration,
                    initiatorType: entry.initiatorType,
                    transferSize: entry.transferSize,
                    encodedBodySize: entry.encodedBodySize,
                    decodedBodySize: entry.decodedBodySize,
                    nextHopProtocol: entry.nextHopProtocol,
                    renderBlockingStatus: (entry as any).renderBlockingStatus,
                }));
            } catch (error) {
                console.error("[MCP] Error getting resource timings:", error);
                return [];
            }
        };

        const getWebVitalsLocal = (): Promise<WebVitalsData> => {
            return new Promise((resolve) => {
                const vitals: WebVitalsData = {};

                if (typeof window === "undefined" || !window.performance) {
                    resolve(vitals);
                    return;
                }

                try {
                    const navTiming = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

                    if (navTiming) {
                        vitals.TTFB = navTiming.responseStart - navTiming.requestStart;
                        vitals.FCP = 0;
                    }

                    const paintEntries = window.performance.getEntriesByType("paint") as PerformancePaintTiming[];
                    paintEntries.forEach((entry) => {
                        if (entry.name === "first-contentful-paint") {
                            vitals.FCP = entry.startTime;
                        }
                    });

                    if ("PerformanceObserver" in window) {
                        let lcpValue = 0;
                        let fidValue: number | undefined;
                        let clsValue = 0;
                        let inpValue: number | undefined;
                        let clsEntries: any[] = [];

                        try {
                            const lcpObserver = new PerformanceObserver((list) => {
                                const entries = list.getEntries();
                                const lastEntry = entries[entries.length - 1] as any;
                                lcpValue = lastEntry.renderTime || lastEntry.loadTime;
                            });
                            lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

                            setTimeout(() => {
                                if (lcpValue > 0) {
                                    vitals.LCP = lcpValue;
                                }
                                lcpObserver.disconnect();
                                checkComplete();
                            }, 3000);
                        } catch (error) {
                            checkComplete();
                        }

                        try {
                            const fidObserver = new PerformanceObserver((list) => {
                                const entries = list.getEntries() as any[];
                                if (entries.length > 0) {
                                    fidValue = entries[0].processingStart - entries[0].startTime;
                                }
                            });
                            fidObserver.observe({ entryTypes: ["first-input"] });

                            setTimeout(() => {
                                if (fidValue !== undefined) {
                                    vitals.FID = fidValue;
                                }
                                fidObserver.disconnect();
                                checkComplete();
                            }, 5000);
                        } catch (error) {
                            checkComplete();
                        }

                        try {
                            const clsObserver = new PerformanceObserver((list) => {
                                for (const entry of list.getEntries() as any[]) {
                                    if (!entry.hadRecentInput) {
                                        clsEntries.push(entry);
                                    }
                                }
                            });
                            clsObserver.observe({ entryTypes: ["layout-shift"] });

                            setTimeout(() => {
                                clsValue = clsEntries.reduce((sum, entry) => sum + (entry.value || 0), 0);
                                if (clsValue > 0) {
                                    vitals.CLS = clsValue;
                                }
                                clsObserver.disconnect();
                                checkComplete();
                            }, 3000);
                        } catch (error) {
                            checkComplete();
                        }

                        try {
                            const inpObserver = new PerformanceObserver((list) => {
                                const entries = list.getEntries() as any[];
                                for (const entry of entries) {
                                    if (entry.entryType === "event" && entry.interactionId) {
                                        const processingTime = (entry as any).processingEnd - (entry as any).processingStart;
                                        if (inpValue === undefined || processingTime > inpValue) {
                                            inpValue = processingTime;
                                        }
                                    }
                                }
                            });
                            inpObserver.observe({ entryTypes: ["event"] });

                            setTimeout(() => {
                                if (inpValue !== undefined) {
                                    vitals.INP = inpValue;
                                }
                                inpObserver.disconnect();
                                checkComplete();
                            }, 5000);
                        } catch (error) {
                            checkComplete();
                        }

                        let completeChecks = 0;
                        const totalChecks = 4;
                        function checkComplete() {
                            completeChecks++;
                            if (completeChecks >= totalChecks) {
                                resolve(vitals);
                            }
                        }
                    } else {
                        setTimeout(() => resolve(vitals), 100);
                    }
                } catch (error) {
                    console.error("[MCP] Error getting web vitals:", error);
                    resolve(vitals);
                }
            });
        };

        const getPerformanceEntriesLocal = (): PerformanceEntryData[] => {
            if (typeof window === "undefined" || !window.performance) {
                return [];
            }

            try {
                const entries = window.performance.getEntries();
                return entries.map((entry) => {
                    const data: PerformanceEntryData = {
                        name: entry.name,
                        entryType: entry.entryType,
                        startTime: entry.startTime,
                        duration: entry.duration,
                    };

                    if (entry.entryType === "navigation") {
                        const navEntry = entry as PerformanceNavigationTiming;
                        Object.assign(data, {
                            domContentLoadedEventStart: navEntry.domContentLoadedEventStart,
                            domContentLoadedEventEnd: navEntry.domContentLoadedEventEnd,
                            domComplete: navEntry.domComplete,
                            loadEventStart: navEntry.loadEventStart,
                            loadEventEnd: navEntry.loadEventEnd,
                        });
                    } else if (entry.entryType === "resource") {
                        const resourceEntry = entry as PerformanceResourceTiming;
                        Object.assign(data, {
                            initiatorType: resourceEntry.initiatorType,
                            transferSize: resourceEntry.transferSize,
                            encodedBodySize: resourceEntry.encodedBodySize,
                            decodedBodySize: resourceEntry.decodedBodySize,
                        });
                    }

                    return data;
                });
            } catch (error) {
                console.error("[MCP] Error getting performance entries:", error);
                return [];
            }
        };

        try {
            const includeResourceTimings = params?.includeResourceTimings !== false;
            const includeNavigationTiming = params?.includeNavigationTiming !== false;
            const includeWebVitals = params?.includeWebVitals !== false;
            const includePerformanceEntries = params?.includePerformanceEntries === true;

            const result: {
                navigationTiming?: NavigationTimingData;
                resourceTimings?: ResourceTimingData[];
                webVitals?: WebVitalsData;
                performanceEntries?: PerformanceEntryData[];
            } = {};

            if (includeNavigationTiming) {
                const navTiming = getNavigationTimingLocal();
                if (navTiming) {
                    result.navigationTiming = navTiming;
                }
            }

            if (includeResourceTimings) {
                result.resourceTimings = getResourceTimingsLocal();
            }

            if (includeWebVitals) {
                result.webVitals = await getWebVitalsLocal();
            }

            if (includePerformanceEntries) {
                result.performanceEntries = getPerformanceEntriesLocal();
            }

            return {
                structuredContent: result,
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Error getting performance metrics: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    },
};

