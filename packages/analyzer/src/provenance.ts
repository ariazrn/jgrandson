import type {
  Diagnostic,
  Program,
  ProvenanceMetadata,
  ProvenanceOrigin,
  TrustState,
  FreshnessState,
} from "@jgrandson/ast";

export interface ProvenanceValue {
  name: string;
  metadata: ProvenanceMetadata;
}

export class ProvenanceTracker {
  private values = new Map<string, ProvenanceMetadata>();
  readonly diagnostics: Diagnostic[] = [];

  register(name: string, origin: ProvenanceOrigin, trust: TrustState = "untrusted", freshness: FreshnessState = "fresh"): void {
    this.values.set(name, { origin, trust, freshness });
  }

  promote(name: string, newTrust: TrustState): void {
    const existing = this.values.get(name);
    if (existing) {
      existing.trust = newTrust;
    }
  }

  get(name: string): ProvenanceMetadata | undefined {
    return this.values.get(name);
  }

  checkAuthoritativeSink(sinkName: string, valueName: string, loc: any): void {
    const prov = this.values.get(valueName);
    if (!prov) return;

    if (prov.origin === "ai" && prov.trust !== "authorized" && prov.trust !== "validated") {
      this.diagnostics.push({
        code: "JG-PROV-UNVALIDATED-AI",
        message: `Unvalidated AI-inferred value '${valueName}' cannot be used in authoritative sink '${sinkName}' without explicit validation or authorization.`,
        severity: "error",
        loc,
      });
    }

    if (prov.origin === "user" && prov.trust === "untrusted" && (sinkName === "rawQuery" || sinkName === "exec")) {
      this.diagnostics.push({
        code: "JG-PROV-UNTRUSTED-USER-INPUT",
        message: `Untrusted user input '${valueName}' cannot flow into critical sink '${sinkName}' without validation.`,
        severity: "error",
        loc,
      });
    }

    if (prov.freshness === "stale") {
      this.diagnostics.push({
        code: "JG-PROV-STALE-VALUE",
        message: `Stale value '${valueName}' from ${prov.origin} cannot be used in '${sinkName}'; refresh required.`,
        severity: "error",
        loc,
      });
    }
  }
}

export function checkProvenance(program: Program): Diagnostic[] {
  const tracker = new ProvenanceTracker();
  const diags: Diagnostic[] = [];

  for (const stmt of program.body) {
    if (stmt.type === "RouteDeclaration") {
      for (const param of stmt.params) {
        tracker.register(param.name, "user", "untrusted", "fresh");
      }
      for (const item of stmt.body) {
        if (item.type === "ExpressionStatement" && item.expression.type === "CallExpression") {
          const callee = item.expression.callee;
          if (callee.type === "Identifier") {
            for (const arg of item.expression.args) {
              if (arg.type === "Identifier") {
                tracker.checkAuthoritativeSink(callee.name, arg.name, item.loc);
              }
            }
          }
        }
      }
    } else if (stmt.type === "FunctionDeclaration") {
      for (const param of stmt.params) {
        if (param.name.toLowerCase().includes("ai") || param.name.toLowerCase().includes("prediction")) {
          tracker.register(param.name, "ai", "untrusted", "fresh");
        }
      }
      for (const item of stmt.body) {
        if (item.type === "ExpressionStatement" && item.expression.type === "CallExpression") {
          const callee = item.expression.callee;
          if (callee.type === "Identifier") {
            for (const arg of item.expression.args) {
              if (arg.type === "Identifier") {
                tracker.checkAuthoritativeSink(callee.name, arg.name, item.loc);
              }
            }
          }
        }
      }
    }
  }

  diags.push(...tracker.diagnostics);
  return diags;
}
