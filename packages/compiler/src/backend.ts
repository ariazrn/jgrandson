import { Program, Diagnostic } from "@jgrandson/ast";

export interface CompileResult {
  /** Emitted file name → file contents. */
  files: Map<string, string>;
  diagnostics: Diagnostic[];
}

export interface CompilerBackend {
  generate(program: Program): CompileResult;
}
