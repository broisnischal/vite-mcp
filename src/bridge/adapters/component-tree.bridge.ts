import type { AdapterBridge } from "../types.js";
import { getComponentTree } from "../utils/component-tree.js";

export class ComponentTreeBridge implements AdapterBridge {
  async execute(params: {
    framework?: string;
    maxDepth?: number;
    includeProps?: boolean;
    includeState?: boolean;
  }): Promise<unknown> {
    const framework = params.framework || "auto";
    const maxDepth = params.maxDepth || 10;
    const includeProps = params.includeProps || false;
    const includeState = params.includeState || false;
    return await getComponentTree(framework, maxDepth, includeProps, includeState);
  }
}

