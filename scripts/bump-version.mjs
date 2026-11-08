import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const TARGET_VERSION = "1.0.0";
const rootDir = process.cwd();

// 1. Root package.json
const rootPkgPath = join(rootDir, "package.json");
const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
rootPkg.version = TARGET_VERSION;
writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");
console.log(`Updated root package.json to ${TARGET_VERSION}`);

// 2. Packages
const packagesDir = join(rootDir, "packages");
const pkgFolders = readdirSync(packagesDir);

for (const folder of pkgFolders) {
  const pkgJsonPath = join(packagesDir, folder, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  pkg.version = TARGET_VERSION;

  if (pkg.dependencies) {
    for (const dep of Object.keys(pkg.dependencies)) {
      if (dep.startsWith("@jgrandson/")) {
        pkg.dependencies[dep] = `^${TARGET_VERSION}`;
      }
    }
  }

  if (pkg.devDependencies) {
    for (const dep of Object.keys(pkg.devDependencies)) {
      if (dep.startsWith("@jgrandson/")) {
        pkg.devDependencies[dep] = `^${TARGET_VERSION}`;
      }
    }
  }

  writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`Updated packages/${folder}/package.json to ${TARGET_VERSION}`);
}

// 3. CLI VERSION constant
const cliMainPath = join(packagesDir, "cli", "src", "main.ts");
let cliMain = readFileSync(cliMainPath, "utf-8");
cliMain = cliMain.replace(/export const VERSION = "[^"]+";/, `export const VERSION = "${TARGET_VERSION}";`);
writeFileSync(cliMainPath, cliMain);
console.log(`Updated VERSION constant in packages/cli/src/main.ts to ${TARGET_VERSION}`);
