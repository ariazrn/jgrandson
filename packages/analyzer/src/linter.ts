import type { Program, Diagnostic, BaseNode } from "@jgrandson/ast";

export function lintProgram(program: Program): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  function walk(node: BaseNode) {
    if (node.type === "BlockStatement") {
      const block = node as any;
      if (block.body.length === 0) {
        diagnostics.push({
          code: "LINT_EMPTY_BLOCK",
          message: "Empty block statement is discouraged.",
          severity: "warning",
          loc: node.loc
        });
      }
    }
    
    // Minimal recursion
    for (const key in node) {
      if (key === "loc" || key === "type") continue;
      const value = (node as any)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object" && typeof item.type === "string") walk(item);
        }
      } else if (value && typeof value === "object" && typeof value.type === "string") {
        walk(value);
      }
    }
  }

  walk(program);

  return diagnostics;
}
