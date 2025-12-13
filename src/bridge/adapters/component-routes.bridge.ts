import type { AdapterBridge } from "../types.js";
import { getComponentRoutes } from "../utils/component-routes.js";

export class ComponentRoutesBridge implements AdapterBridge {
  async execute(params: { framework?: string }): Promise<unknown> {
    const framework = params.framework || "auto";
    return await getComponentRoutes(framework);
  }
}

