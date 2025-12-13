import type { AdapterBridge } from "../types.js";

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

function getNavigationTiming(): NavigationTimingData | undefined {
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
}

function getResourceTimings(): ResourceTimingData[] {
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
}

function getWebVitals(): Promise<WebVitalsData> {
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
                            if (entry.entryType === "event" && (entry as any).interactionId) {
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
}

function getPerformanceEntries(): PerformanceEntryData[] {
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
}

export class PerformanceBridge implements AdapterBridge {
    async execute(params: {
        includeResourceTimings?: boolean;
        includeNavigationTiming?: boolean;
        includeWebVitals?: boolean;
        includePerformanceEntries?: boolean;
    }): Promise<unknown> {
        if (typeof window === "undefined") {
            return {
                navigationTiming: undefined,
                resourceTimings: [],
                webVitals: {},
                performanceEntries: [],
            };
        }

        try {
            const includeResourceTimings = params.includeResourceTimings !== false;
            const includeNavigationTiming = params.includeNavigationTiming !== false;
            const includeWebVitals = params.includeWebVitals !== false;
            const includePerformanceEntries = params.includePerformanceEntries === true;

            const result: {
                navigationTiming?: NavigationTimingData;
                resourceTimings?: ResourceTimingData[];
                webVitals?: WebVitalsData;
                performanceEntries?: PerformanceEntryData[];
            } = {};

            if (includeNavigationTiming) {
                const navTiming = getNavigationTiming();
                if (navTiming) {
                    result.navigationTiming = navTiming;
                }
            }

            if (includeResourceTimings) {
                result.resourceTimings = getResourceTimings();
            }

            if (includeWebVitals) {
                result.webVitals = await getWebVitals();
            }

            if (includePerformanceEntries) {
                result.performanceEntries = getPerformanceEntries();
            }

            return result;
        } catch (error) {
            console.error("[MCP] Error getting performance metrics:", error);
            return {
                navigationTiming: undefined,
                resourceTimings: [],
                webVitals: {},
                performanceEntries: [],
            };
        }
    }
}

