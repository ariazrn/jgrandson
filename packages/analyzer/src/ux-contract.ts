import type { Diagnostic, Program } from "@jgrandson/ast";

export interface VisualPatch {
  targetElement: string;
  property: string;
  newValue: string;
}

export function applyVisualPatch(source: string, patch: VisualPatch): string {
  // Safe round-trip text replacement preserving structure
  const regex = new RegExp(`(${patch.targetElement}\\s*\\{[^}]*${patch.property}\\s*:\\s*)([^\\r\\n}]+)`, "g");
  if (regex.test(source)) {
    return source.replace(regex, `$1${patch.newValue}`);
  }
  return source;
}

export function checkUxContracts(program: Program): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const stmt of program.body) {
    if (stmt.type === "Page" || stmt.type === "Component") {
      for (const item of stmt.body) {
        if (item.type === "Element" && item.name === "button") {
          const hasLabel = item.items.some(
            i => (i.type === "Property" && (i.key === "text" || i.key === "ariaLabel")) ||
                 (i.type === "Element" && i.name === "text")
          );
          if (!hasLabel) {
            diagnostics.push({
              code: "JG-UX-UNLABELED-INTERACTIVE",
              message: `Interactive control '<button>' in '${stmt.name}' lacks an accessible name or text property (fails UX Contract).`,
              severity: "warning",
              loc: item.loc,
            });
          }
        }
      }
    }
  }

  return diagnostics;
}
