import type { Diagnostic } from "@jgrandson/ast";

export interface AiAuthorityContract {
  actionName: string;
  isConsequential: boolean;
  requiresHumanApproval: boolean;
  hasFallback: boolean;
}

export function validateAiAuthority(contract: AiAuthorityContract): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (contract.isConsequential && !contract.requiresHumanApproval) {
    diagnostics.push({
      code: "JG-AI-CONSEQUENTIAL-APPROVAL-REQUIRED",
      message: `Consequential AI action '${contract.actionName}' requires explicit human approval policy before execution.`,
      severity: "error",
      loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
    });
  }

  if (!contract.hasFallback) {
    diagnostics.push({
      code: "JG-AI-DEGRADATION-FALLBACK-REQUIRED",
      message: `AI action '${contract.actionName}' must declare a deterministic non-AI fallback handler for offline or degraded operation.`,
      severity: "error",
      loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
    });
  }

  return diagnostics;
}
