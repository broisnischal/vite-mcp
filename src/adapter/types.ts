import type { z } from "zod";
import type { Handler, ServerMethods } from "../bridge/bridge.js";

type ComponentFactory = (Base: typeof HTMLElement) => CustomElementConstructor;

export interface AdapterDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema?: z.ZodSchema;
  handler: Handler;
  component?: ComponentFactory;
  server?: ServerMethods;
}
