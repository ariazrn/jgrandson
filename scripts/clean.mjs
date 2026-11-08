/**
 * Remove all compiled outputs (`dist/` dirs and `*.tsbuildinfo` files) across
 * every package and the repo root. Run via `npm run clean`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function rm(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("cleaned " + path.relative(ROOT, p));
  }
}

const pkgsRoot = path.join(ROOT, "packages");
for (const pkg of fs.readdirSync(pkgsRoot).filter((d) => !d.startsWith("."))) {
  rm(path.join(pkgsRoot, pkg, "dist"));
  rm(path.join(pkgsRoot, pkg, "tsconfig.tsbuildinfo"));
}

rm(path.join(ROOT, "tsconfig.tsbuildinfo"));
