import type {
  Component,
  Page,
  Program,
  SourceLocation,
} from "@jgrandson/ast";

export type GuaranteeClass = "proven" | "guarded" | "observed";

export interface DecisionNode {
  code: string;
  symbol: string;
  target: "native-html" | "native-dom" | "react-island" | "server-route" | "server-tool";
  shipsJavaScript: boolean;
  guarantee: GuaranteeClass;
  reasons: string[];
  effects: string[];
  dependencies: string[];
  loc: SourceLocation;
}

export interface ExplanationReport {
  sourceName: string;
  summary: {
    totalDeclarations: number;
    staticZeroJsCount: number;
    interactiveCount: number;
    serverCount: number;
  };
  nodes: DecisionNode[];
}

export function explainProgram(program: Program): ExplanationReport {
  const nodes: DecisionNode[] = [];

  for (const stmt of program.body) {
    if (stmt.type === "Page" || stmt.type === "Component") {
      const node = explainComponentOrPage(stmt);
      nodes.push(node);
    } else if (stmt.type === "RouteDeclaration") {
      nodes.push({
        code: "JG-EXP-SERVER-ROUTE",
        symbol: `${stmt.method} ${stmt.path}`,
        target: "server-route",
        shipsJavaScript: false,
        guarantee: "proven",
        reasons: ["Server-side HTTP route handler; does not bundle to the browser client."],
        effects: ["network:http-response", "server:execution"],
        dependencies: stmt.params.map(p => p.name),
        loc: stmt.loc,
      });
    } else if (stmt.type === "ToolDeclaration") {
      nodes.push({
        code: "JG-EXP-SERVER-TOOL",
        symbol: stmt.name,
        target: "server-tool",
        shipsJavaScript: false,
        guarantee: "proven",
        reasons: [`AI agent tool with validated JSON schema for ${stmt.name}.`],
        effects: ["ai:tool-invocation"],
        dependencies: stmt.params.map(p => p.name),
        loc: stmt.loc,
      });
    }
  }

  const staticZeroJsCount = nodes.filter(n => !n.shipsJavaScript && (n.target === "native-html")).length;
  const interactiveCount = nodes.filter(n => n.shipsJavaScript).length;
  const serverCount = nodes.filter(n => n.target === "server-route" || n.target === "server-tool").length;

  return {
    sourceName: program.sourceName || "anonymous",
    summary: {
      totalDeclarations: nodes.length,
      staticZeroJsCount,
      interactiveCount,
      serverCount,
    },
    nodes,
  };
}

function explainComponentOrPage(item: Page | Component): DecisionNode {
  const hasState = item.body.some(b => b.type === "StateBlock");
  const events: string[] = [];
  const islands: string[] = [];
  const dependencies: string[] = [];

  function walk(blocks: any[]) {
    for (const b of blocks) {
      if (b.type === "EventBlock") {
        events.push(b.name);
      } else if (b.type === "Element") {
        if (/^[A-Z]/.test(b.name)) {
          islands.push(b.name);
          dependencies.push(b.name);
        }
        if (b.items) walk(b.items);
      } else if (b.type === "IfStatement") {
        if (b.consequent?.body) walk(b.consequent.body);
        if (b.alternate?.body) walk(b.alternate.body);
      } else if (b.type === "ForStatement") {
        if (b.body?.body) walk(b.body.body);
      }
    }
  }

  walk(item.body);

  const reasons: string[] = [];
  const effects: string[] = [];
  let target: DecisionNode["target"] = "native-html";
  let shipsJavaScript = false;
  let code = "JG-EXP-STATIC-ZERO-JS";

  if (islands.length > 0) {
    target = "react-island";
    shipsJavaScript = true;
    code = "JG-EXP-REACT-ISLAND";
    reasons.push(`Contains React compatibility island(s): ${islands.join(", ")}`);
    effects.push("dom:vdom-mount");
  } else if (hasState || events.length > 0) {
    target = "native-dom";
    shipsJavaScript = true;
    code = "JG-EXP-INTERACTIVE-DOM";
    if (hasState) reasons.push("Declares dynamic state variable(s) triggering fine-grained reactivity.");
    if (events.length > 0) {
      reasons.push(`Listens to browser event handler(s): ${events.join(", ")}.`);
      effects.push(...events.map(e => `dom:event:${e}`));
    }
  } else {
    reasons.push("Static element tree with zero client interaction; compiles directly to zero-JS HTML/CSS.");
    effects.push("dom:static-render");
  }

  return {
    code,
    symbol: item.name,
    target,
    shipsJavaScript,
    guarantee: "proven",
    reasons,
    effects,
    dependencies,
    loc: item.loc,
  };
}
