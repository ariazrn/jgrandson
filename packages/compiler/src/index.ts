export { CompileResult, CompilerBackend } from "./backend";
export * from "./ir";
export { ReactBackend } from "./react";
export { NativeBackend } from "./native";
export { WasmBackend } from "./wasm";

import { Program } from "@jgrandson/ast";
import { CompileResult } from "./backend";
import { ReactBackend } from "./react";
import { NativeBackend } from "./native";
import { WasmBackend } from "./wasm";

export type CompileTarget = "react" | "native" | "wasm";

export function compile(program: Program, target: CompileTarget = "react"): CompileResult {
  if (target === "wasm") {
    return new WasmBackend().generate(program);
  }
  if (target === "native") {
    return new NativeBackend().generate(program);
  }
  return new ReactBackend().generate(program);
}
