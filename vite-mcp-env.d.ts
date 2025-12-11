/**
 * Type helpers for vite-mcp's virtual modules.
 *
 * Add this file to your project so TypeScript can resolve the module signatures:
 *
 * tsconfig.json
 * {
 *   "compilerOptions": { ... },
 *   "include": [
 *     "node_modules/vite-mcp/vite-mcp-env.d.ts"
 *   ]
 * }
 *
 * Or place a reference directive at the top of your main entry:
 * /// <reference types="vite-mcp/vite-mcp-env" />
 */

declare module "virtual:mcp" {
  // The module doesn't export anything, it just initializes the bridge
  // Import it for side effects only: import "/virtual:mcp" or import "virtual:mcp"
}
