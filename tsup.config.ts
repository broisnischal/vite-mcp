import { defineConfig } from "tsup";
import { copyFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ["vite"],
    outDir: "dist",
    onSuccess: async () => {
      // Copy browser-bridge.ts to dist directory
      const srcPath = join(process.cwd(), "src", "browser-bridge.ts");
      const destPath = join(process.cwd(), "dist", "browser-bridge.ts");
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath);
        console.log("✓ Copied browser-bridge.ts to dist/");
      }
      // Copy virtual-mcp.d.ts to dist directory
      const typesPath = join(process.cwd(), "src", "virtual-mcp.d.ts");
      const typesDestPath = join(process.cwd(), "dist", "virtual-mcp.d.ts");
      if (existsSync(typesPath)) {
        copyFileSync(typesPath, typesDestPath);
        console.log("✓ Copied virtual-mcp.d.ts to dist/");
      }
      // Ensure vite-mcp-env.d.ts in root has the declaration (for package distribution)
      const envTypesPath = join(process.cwd(), "vite-mcp-env.d.ts");
      const envTypesContent = `/**
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
`;
      writeFileSync(envTypesPath, envTypesContent, "utf-8");
      console.log("✓ Ensured vite-mcp-env.d.ts has virtual:mcp declaration");
    },
  },
  {
    entry: ["src/adapter/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    outDir: "dist/adapters",
  },
]);
