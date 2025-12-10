import { defineConfig } from 'tsup';
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ['vite'],
    outDir: 'dist',
    onSuccess: async () => {
      // Copy browser-bridge.ts to dist directory
      const srcPath = join(process.cwd(), 'src', 'browser-bridge.ts');
      const destPath = join(process.cwd(), 'dist', 'browser-bridge.ts');
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath);
        console.log('✓ Copied browser-bridge.ts to dist/');
      }
    },
  },
  {
    entry: ['src/adapter/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    outDir: 'dist/adapters',
  },
]);
