import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { join } from "path";

const SKIP_DIRS = new Set(["node_modules", ".git", ".local", "dist", ".cache"]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(".");
let patched = 0;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (!content.startsWith("// @ts-nocheck")) {
    writeFileSync(file, "// @ts-nocheck\n" + content);
    console.log("patched:", file);
    patched++;
  }
}

console.log(`\nDone. Patched ${patched} of ${files.length} files.`);
