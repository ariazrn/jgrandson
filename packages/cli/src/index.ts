/**
 * Public entry point for `@jgrandson/cli`.
 *
 * Exposes the pieces that need to be testable in isolation:
 *  - {@link VERSION}     the installed CLI version.
 *  - {@link parseArgs}   tokeniser for argv (flags vs positional args).
 *  - {@link run}         the command dispatcher (returns an exit code).
 */
export { VERSION, parseArgs, formatSource, run } from "./main";
export type { ParsedArgs, ExitCode, JGrandsonConfig } from "./main";
export { jgrandson } from "./vite";
export type { JGrandsonVitePluginOptions } from "./vite";
