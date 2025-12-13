import { readFileSync, statSync } from "fs";
import { join } from "path";

const filesToMeasure = [
  "dist/index.js",
  "dist/index.cjs",
  "dist/adapters/index.js",
  "dist/adapters/index.cjs",
  "dist/bridge/index.js",
];

const sizes = {};

for (const file of filesToMeasure) {
  try {
    const filePath = join(process.cwd(), file);
    const stats = statSync(filePath);
    sizes[file] = stats.size;
  } catch (error) {
    sizes[file] = 0;
  }
}

console.log(JSON.stringify(sizes, null, 2));
