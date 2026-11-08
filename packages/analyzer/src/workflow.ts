import type { Diagnostic } from "@jgrandson/ast";

export interface WorkflowTransition {
  event: string;
  target: string;
  guard?: string;
  idempotent?: boolean;
}

export interface WorkflowState {
  name: string;
  isTerminal?: boolean;
  transitions: WorkflowTransition[];
}

export interface WorkflowContract {
  name: string;
  initialState: string;
  states: WorkflowState[];
}

export function validateWorkflow(workflow: WorkflowContract): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const stateNames = new Set(workflow.states.map(s => s.name));

  if (!stateNames.has(workflow.initialState)) {
    diagnostics.push({
      code: "JG-WORKFLOW-INVALID-INITIAL",
      message: `Workflow '${workflow.name}' initial state '${workflow.initialState}' does not exist in declared states.`,
      severity: "error",
      loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
    });
  }

  for (const state of workflow.states) {
    if (!state.isTerminal && state.transitions.length === 0) {
      diagnostics.push({
        code: "JG-WORKFLOW-DEAD-END",
        message: `Non-terminal state '${state.name}' in workflow '${workflow.name}' has no outgoing transitions.`,
        severity: "error",
        loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
      });
    }

    for (const tr of state.transitions) {
      if (!stateNames.has(tr.target)) {
        diagnostics.push({
          code: "JG-WORKFLOW-INVALID-TARGET",
          message: `Transition on event '${tr.event}' from state '${state.name}' references undeclared target state '${tr.target}'.`,
          severity: "error",
          loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
        });
      }
    }
  }

  return diagnostics;
}
