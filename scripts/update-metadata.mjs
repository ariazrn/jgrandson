import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packages = [
  ".",
  "packages/analyzer",
  "packages/ast",
  "packages/cli",
  "packages/compiler",
  "packages/language-server",
  "packages/lexer",
  "packages/parser",
  "editors/vscode-jgrandson"
];

const metadata = {
  repository: {
    type: "git",
    url: "git+https://github.com/jgrandson/jgrandson.git"
  },
  bugs: {
    url: "https://github.com/jgrandson/jgrandson/issues"
  },
  homepage: "https://jgrandson.dev",
  author: "JGrandson Team <team@jgrandson.dev>",
};

for (const pkg of packages) {
  const path = join(process.cwd(), pkg, "package.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  
  Object.assign(data, metadata);
  
  if (pkg !== ".") {
    data.publishConfig = { access: "public" };
    // add keywords if not present
    if (!data.keywords) {
      data.keywords = ["jgrandson", "language", "compiler", "react"];
    }
  }
  
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
