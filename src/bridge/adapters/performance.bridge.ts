import type { AdapterBridge } from "../types.js";
import { getPerformanceMetrics } from "../utils/performance.js";

export class PerformanceBridge implements AdapterBridge {
  async execute(params: {
    includeResourceTimings?: boolean;
    includeNavigationTiming?: boolean;
    includeWebVitals?: boolean;
    includePerformanceEntries?: boolean;
  }): Promise<unknown> {
    return await getPerformanceMetrics({
      includeResourceTimings: params.includeResourceTimings !== false,
      includeNavigationTiming: params.includeNavigationTiming !== false,
      includeWebVitals: params.includeWebVitals !== false,
      includePerformanceEntries: params.includePerformanceEntries === true,
    });
  }
}

