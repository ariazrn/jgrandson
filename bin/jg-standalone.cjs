

"use strict";
// JGrandson Single-Binary Self-Contained Bundle
const { createRequire } = require("node:module");
const __diskRequire = createRequire(__filename || process.cwd() + "/");
const path = require("node:path");
const fs = require("node:fs");
const child_process = require("node:child_process");
const http = require("node:http");


// Setup module resolution
const origResolve = __diskRequire("module")._resolveFilename;
const pkgMap = {
  "@jgrandson/ast": "C:\\Work stuff\\jgroundson\\packages\\ast\\dist\\index.js",
  "@jgrandson/lexer": "C:\\Work stuff\\jgroundson\\packages\\lexer\\dist\\index.js",
  "@jgrandson/parser": "C:\\Work stuff\\jgroundson\\packages\\parser\\dist\\index.js",
  "@jgrandson/analyzer": "C:\\Work stuff\\jgroundson\\packages\\analyzer\\dist\\index.js",
  "@jgrandson/compiler": "C:\\Work stuff\\jgroundson\\packages\\compiler\\dist\\index.js",
  "@jgrandson/cli": "C:\\Work stuff\\jgroundson\\packages\\cli\\dist\\index.js",
};

__diskRequire("module")._resolveFilename = function(request, parent, isMain, options) {
  if (pkgMap[request]) {
    return pkgMap[request];
  }
  return origResolve.call(this, request, parent, isMain, options);
};

__diskRequire("C:\\Work stuff\\jgroundson\\packages\\cli\\dist\\cli.js");
