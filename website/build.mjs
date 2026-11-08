import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname);
const outputRoot = resolve(projectRoot, "dist");

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  copyFileSync(resolve(projectRoot, file), resolve(outputRoot, file));
}

console.log(`Built JGrandson documentation in ${outputRoot}`);
