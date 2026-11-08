import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration. Workspace packages are imported via `@jgrandson/*`
 * aliases that point directly at their `src` directories, so the test suite
 * runs against source (no build step required) and stays fast and accurate.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@jgrandson/ast": path.resolve(__dirname, "packages/ast/src/index.ts"),
      "@jgrandson/lexer": path.resolve(__dirname, "packages/lexer/src/index.ts"),
      "@jgrandson/parser": path.resolve(__dirname, "packages/parser/src/index.ts"),
      "@jgrandson/analyzer": path.resolve(__dirname, "packages/analyzer/src/index.ts"),
      "@jgrandson/compiler": path.resolve(__dirname, "packages/compiler/src/index.ts"),
      "@jgrandson/cli/vite": path.resolve(__dirname, "packages/cli/src/vite.ts"),
      "@jgrandson/cli": path.resolve(__dirname, "packages/cli/src/index.ts"),
      "@jgrandson/runtime": path.resolve(__dirname, "packages/runtime/src/index.ts"),
    },
  },
});
