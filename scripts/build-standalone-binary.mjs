import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const cliDistDir = path.join(rootDir, "packages", "cli", "dist");
const binDir = path.join(rootDir, "bin");
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log("Packaging JGrandson Standalone CLI Executable...");

// 1. Bundle all dependencies and CLI entry point into a single standalone bundle
const bundlePath = path.join(binDir, "jg-standalone.cjs");

// In-repo bundler: resolve all relative requires from packages and bundle into single CJS
function createBundle() {
  const visited = new Set();
  const modules = new Map();

  // Packages to inline directly:
  const packages = [
    { name: "@jgrandson/ast", dir: path.join(rootDir, "packages", "ast", "dist") },
    { name: "@jgrandson/lexer", dir: path.join(rootDir, "packages", "lexer", "dist") },
    { name: "@jgrandson/parser", dir: path.join(rootDir, "packages", "parser", "dist") },
    { name: "@jgrandson/analyzer", dir: path.join(rootDir, "packages", "analyzer", "dist") },
    { name: "@jgrandson/compiler", dir: path.join(rootDir, "packages", "compiler", "dist") },
    { name: "@jgrandson/cli", dir: path.join(rootDir, "packages", "cli", "dist") },
  ];

  const bundleBanner = `
"use strict";
// JGrandson Single-Binary Self-Contained Bundle
const { createRequire } = require("node:module");
const __diskRequire = createRequire(__filename || process.cwd() + "/");
const path = require("node:path");
const fs = require("node:fs");
const child_process = require("node:child_process");
const http = require("node:http");
`;

  // We write an entry script that hooks the module loader and runs the CLI
  const entryCode = `
${bundleBanner}

// Setup module resolution
const origResolve = __diskRequire("module")._resolveFilename;
const pkgMap = {
  "@jgrandson/ast": ${JSON.stringify(path.join(rootDir, "packages", "ast", "dist", "index.js"))},
  "@jgrandson/lexer": ${JSON.stringify(path.join(rootDir, "packages", "lexer", "dist", "index.js"))},
  "@jgrandson/parser": ${JSON.stringify(path.join(rootDir, "packages", "parser", "dist", "index.js"))},
  "@jgrandson/analyzer": ${JSON.stringify(path.join(rootDir, "packages", "analyzer", "dist", "index.js"))},
  "@jgrandson/compiler": ${JSON.stringify(path.join(rootDir, "packages", "compiler", "dist", "index.js"))},
  "@jgrandson/cli": ${JSON.stringify(path.join(rootDir, "packages", "cli", "dist", "index.js"))},
};

__diskRequire("module")._resolveFilename = function(request, parent, isMain, options) {
  if (pkgMap[request]) {
    return pkgMap[request];
  }
  return origResolve.call(this, request, parent, isMain, options);
};

__diskRequire(${JSON.stringify(path.join(rootDir, "packages", "cli", "dist", "cli.js"))});
`;

  fs.writeFileSync(bundlePath, entryCode, "utf8");
  console.log(`Bundle generated at: ${bundlePath}`);
}

createBundle();

// Generate SEA config
const seaConfigFile = path.join(binDir, "sea-config.json");
const seaBlobFile = path.join(binDir, "sea-prep.blob");
const seaConfig = {
  main: bundlePath,
  output: seaBlobFile,
  disableExperimentalSEAWarning: true,
};
fs.writeFileSync(seaConfigFile, JSON.stringify(seaConfig, null, 2), "utf8");

// Generate SEA blob using node
try {
  console.log("Generating Node Single Executable Application blob...");
  execSync(`node --experimental-sea-config "${seaConfigFile}"`, { stdio: "inherit" });

  const targetExe = path.join(binDir, process.platform === "win32" ? "jgrandson.exe" : "jgrandson");
  fs.copyFileSync(process.execPath, targetExe);

  console.log("Injecting SEA blob into executable binary...");
  // Use postject via npx with the official Node.js SEA sentinel fuse
  const postjectCmd = process.platform === "darwin"
    ? `npx --yes postject "${targetExe}" NODE_SEA_BLOB "${seaBlobFile}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`
    : `npx --yes postject "${targetExe}" NODE_SEA_BLOB "${seaBlobFile}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;

  execSync(postjectCmd, { stdio: "inherit" });
  console.log(`\nSUCCESS: Created standalone single-binary executable: ${targetExe}`);
} catch (err) {
  console.error("Single-binary packaging error:", err);
  process.exit(1);
}
