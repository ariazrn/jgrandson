#!/usr/bin/env node
/**
 * Stable bin shim for the `jg` command.
 *
 * Kept as plain JS (outside `src/`, so never touched by tsc) so the shebang is
 * always preserved on install. It simply delegates to the compiled CLI.
 */
"use strict";
require("../dist/cli.js");
