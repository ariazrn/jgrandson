import type { Diagnostic } from "@jgrandson/ast";

export type EffectType =
  | "network:http"
  | "database:query"
  | "database:mutation"
  | "storage:io"
  | "secret:read"
  | "ai:generate"
  | "ai:tool-exec"
  | "dom:render";

export interface ActionBudget {
  maxDatabaseQueries?: number;
  maxAiCalls?: number;
  maxExecutionTimeMs?: number;
  maxTokens?: number;
}

export interface InferredActionEffects {
  actionName: string;
  effects: EffectType[];
  estimatedCostRange?: [number, number];
  exceedsBudget?: boolean;
}

export function inferActionEffects(actionName: string, callCount: { db?: number; ai?: number }, budget?: ActionBudget): {
  effects: EffectType[];
  diagnostics: Diagnostic[];
} {
  const effects: EffectType[] = [];
  const diagnostics: Diagnostic[] = [];

  const db = callCount.db ?? 0;
  const ai = callCount.ai ?? 0;

  if (db > 0) effects.push("database:query");
  if (ai > 0) effects.push("ai:generate");

  if (budget?.maxDatabaseQueries !== undefined && db > budget.maxDatabaseQueries) {
    diagnostics.push({
      code: "JG-BUDGET-EXCEEDED-DB",
      message: `Action '${actionName}' exceeds declared database budget: made ${db} queries, max allowed is ${budget.maxDatabaseQueries}.`,
      severity: "error",
      loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
    });
  }

  if (budget?.maxAiCalls !== undefined && ai > budget.maxAiCalls) {
    diagnostics.push({
      code: "JG-BUDGET-EXCEEDED-AI",
      message: `Action '${actionName}' exceeds declared AI call budget: made ${ai} calls, max allowed is ${budget.maxAiCalls}.`,
      severity: "error",
      loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
    });
  }

  return { effects, diagnostics };
}
