function getWebVitalsRating(value: number, thresholds: { good: number; poor: number }): "good" | "needs-improvement" | "poor" {
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.poor) return "needs-improvement";
  return "poor";
}

export async function getPerformanceMetrics(options: {
  includeResourceTimings?: boolean;
  includeNavigationTiming?: boolean;
  includeWebVitals?: boolean;
  includePerformanceEntries?: boolean;
}): Promise<{
  timestamp: number;
  url: string;
  webVitals?: Record<string, { value: number; rating: "good" | "needs-improvement" | "poor" }>;
  navigationTiming?: Record<string, number | undefined>;
  resourceTiming?: {
    resources: Array<{
      name: string;
      initiatorType?: string;
      duration?: number;
      transferSize?: number;
      encodedBodySize?: number;
      decodedBodySize?: number;
      startTime?: number;
      responseEnd?: number;
    }>;
    totalTransferSize: number;
    totalEncodedSize: number;
    totalDecodedSize: number;
  };
  performanceEntries?: Array<{
    startTime: number;
    duration: number;
    name: string;
    entryType: string;
  }>;
}> {
  const result: {
    timestamp: number;
    url: string;
    webVitals?: Record<string, { value: number; rating: "good" | "needs-improvement" | "poor" }>;
    navigationTiming?: Record<string, number | undefined>;
    resourceTiming?: {
      resources: Array<{
        name: string;
        initiatorType?: string;
        duration?: number;
        transferSize?: number;
        encodedBodySize?: number;
        decodedBodySize?: number;
        startTime?: number;
        responseEnd?: number;
      }>;
      totalTransferSize: number;
      totalEncodedSize: number;
      totalDecodedSize: number;
    };
    performanceEntries?: Array<{
      startTime: number;
      duration: number;
      name: string;
      entryType: string;
    }>;
  } = {
    timestamp: Date.now(),
    url: window.location.href,
  };

  if (options.includeWebVitals && "PerformanceObserver" in window) {
    const webVitals: Record<string, { value: number; rating: "good" | "needs-improvement" | "poor" }> = {};

    try {
      const perfEntries = performance.getEntriesByType("navigation");
      if (perfEntries.length > 0) {
        const navEntry = perfEntries[0] as PerformanceNavigationTiming;
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        webVitals.ttfb = {
          value: ttfb,
          rating: getWebVitalsRating(ttfb, { good: 200, poor: 500 }),
        };
      }
    } catch (e) {
      // ignore
    }

    try {
      const paintEntries = performance.getEntriesByType("paint") as PerformancePaintTiming[];
      const fcpEntry = paintEntries.find((entry) => entry.name === "first-contentful-paint");
      if (fcpEntry) {
        webVitals.fcp = {
          value: fcpEntry.startTime,
          rating: getWebVitalsRating(fcpEntry.startTime, { good: 1800, poor: 3000 }),
        };
      }
    } catch (e) {
      // ignore
    }

    try {
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint") as PerformanceEntry[];
      if (lcpEntries.length > 0) {
        const lcpEntry = lcpEntries[lcpEntries.length - 1] as any;
        webVitals.lcp = {
          value: lcpEntry.renderTime || lcpEntry.loadTime,
          rating: getWebVitalsRating(lcpEntry.renderTime || lcpEntry.loadTime, { good: 2500, poor: 4000 }),
        };
      }
    } catch (e) {
      // ignore
    }

    try {
      const fidEntries = performance.getEntriesByType("first-input") as PerformanceEventTiming[];
      if (fidEntries.length > 0) {
        const fidEntry = fidEntries[0];
        webVitals.fid = {
          value: fidEntry.processingStart - fidEntry.startTime,
          rating: getWebVitalsRating(fidEntry.processingStart - fidEntry.startTime, { good: 100, poor: 300 }),
        };
      }
    } catch (e) {
      // ignore
    }

    try {
      const clsEntries = performance.getEntriesByType("layout-shift") as PerformanceEntry[];
      if (clsEntries.length > 0) {
        let clsValue = 0;
        clsEntries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        webVitals.cls = {
          value: clsValue,
          rating: getWebVitalsRating(clsValue, { good: 0.1, poor: 0.25 }),
        };
      }
    } catch (e) {
      // ignore
    }

    if (Object.keys(webVitals).length > 0) {
      result.webVitals = webVitals;
    }
  }

  if (options.includeNavigationTiming && "performance" in window) {
    try {
      const navTiming = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (navTiming) {
        result.navigationTiming = {
          navigationStart: navTiming.navigationStart,
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
          domLoading: navTiming.domLoading,
          domInteractive: navTiming.domInteractive,
          domContentLoadedEventStart: navTiming.domContentLoadedEventStart,
          domContentLoadedEventEnd: navTiming.domContentLoadedEventEnd,
          domComplete: navTiming.domComplete,
          loadEventStart: navTiming.loadEventStart,
          loadEventEnd: navTiming.loadEventEnd,
        };
      }
    } catch (e) {
      // ignore
    }
  }

  if (options.includeResourceTimings && "performance" in window) {
    try {
      const resourceEntries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const resources = resourceEntries.map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: entry.duration,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
        startTime: entry.startTime,
        responseEnd: entry.responseEnd,
      }));

      const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const totalEncodedSize = resources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0);
      const totalDecodedSize = resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);

      result.resourceTiming = {
        resources,
        totalTransferSize,
        totalEncodedSize,
        totalDecodedSize,
      };
    } catch (e) {
      // ignore
    }
  }

  if (options.includePerformanceEntries && "performance" in window) {
    try {
      const allEntries = performance.getEntries();
      result.performanceEntries = allEntries.map((entry) => ({
        startTime: entry.startTime,
        duration: entry.duration,
        name: entry.name,
        entryType: entry.entryType,
      }));
    } catch (e) {
      // ignore
    }
  }

  return result;
}

