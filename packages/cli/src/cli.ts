#!/usr/bin/env node
/**
 * Bin entry point for the `jg` command.
 *
 * Delegates all work to {@link run} in `./main` so the same logic can be unit
 * tested directly via `@jgrandson/cli`'s exported `main`.
 */
import { run } from "./main";

const code = run(process.argv.slice(2));
process.exitCode = code;
