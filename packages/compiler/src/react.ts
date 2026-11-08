import type {
  Program,
  Page,
  Component,
  FunctionDeclaration,
  StyleBlock,
  Element,
  EventBlock,
  IfStatement,
  ForStatement,
  ReturnStatement,
  AssignmentExpression,
  UpdateExpression,
  Identifier,
  Literal,
  VariableDeclarator,
  Parameter,
  TypeAnnotation,
  Expression,
  Statement,
  BlockItem,
  Diagnostic,
  Slot,
  RouteDeclaration,
} from "@jgrandson/ast";

export interface CompileResult {
  /** Emitted file name → file contents. */
  files: Map<string, string>;
  diagnostics: Diagnostic[];
}

interface CompileContext {
  /** State variable names owned by the current component. */
  stateVars: Set<string>;
  /** Collected handler declarations to hoist above the JSX return. */
  handlers: string[];
  handlerCounts: Map<string, number>;
  componentParams: Map<string, string[]>;
}

function newContext(componentParams: Map<string, string[]>): CompileContext {
  return { stateVars: new Set(), handlers: [], handlerCounts: new Map(), componentParams };
}

function typeAnnotationToTS(type: TypeAnnotation | null): string {
  if (!type) return "any";
  switch (type.kind) {
    case "string":
    case "number":
    case "boolean":
    case "void":
    case "any":
      return type.kind;
    case "null":
      return "null";
    case "array":
      return `${typeAnnotationToTS(type.elementType ?? null)}[]`;
    case "object":
      if (type.properties && type.properties.length > 0) {
        return `{ ${type.properties.map((p) => `${p.name}${p.optional ? "?" : ""}: ${typeAnnotationToTS(p.typeAnnotation)}`).join("; ")} }`;
      }
      return "Record<string, unknown>";
    case "union":
      return type.types && type.types.length > 0
        ? type.types.map(typeAnnotationToTS).join(" | ")
        : "any";
    case "reference":
      return type.refName ?? "unknown";
  }
}

function paramToTS(param: Parameter): string {
  return `${param.name}${param.optional || param.defaultValue ? "?" : ""}: ${typeAnnotationToTS(param.typeAnnotation)}`;
}

function setterName(name: string): string {
  return `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function expressionToTS(expr: Expression | import("@jgrandson/ast").SpreadElement, ctx: CompileContext): string {
  if (expr.type === "SpreadElement") {
    return `...${expressionToTS(expr.argument, ctx)}`;
  }
  switch (expr.type) {
    case "Identifier":
      return expr.name;
    case "Literal":
      return expr.literalType === "string" ? JSON.stringify(expr.value) : String(expr.value);
    case "BinaryExpression":
      return `(${expressionToTS(expr.left, ctx)} ${expr.operator} ${expressionToTS(expr.right, ctx)})`;
    case "LogicalExpression":
      return `(${expressionToTS(expr.left, ctx)} ${expr.operator} ${expressionToTS(expr.right, ctx)})`;
    case "UnaryExpression":
      return `(${expr.operator}${expressionToTS(expr.argument, ctx)})`;
    case "UpdateExpression":
      return `${expressionToTS(expr.argument, ctx)}${expr.operator}`;
    case "MemberExpression": {
      const obj = expressionToTS(expr.object, ctx);
      return expr.computed
        ? `${obj}[${expressionToTS(expr.property, ctx)}]`
        : `${obj}.${(expr.property as Identifier).name}`;
    }
    case "CallExpression":
      return `${expressionToTS(expr.callee, ctx)}(${expr.args.map((a) => expressionToTS(a, ctx)).join(", ")})`;
    case "ArrayLiteral":
      return `[${expr.elements.map((e) => expressionToTS(e, ctx)).join(", ")}]`;
    case "ObjectLiteral":
      return `{ ${expr.properties.map((p) => {
        if ("type" in p && p.type === "SpreadElement") return expressionToTS(p as import("@jgrandson/ast").SpreadElement, ctx);
        return `${(p as any).key}: ${expressionToTS((p as any).value, ctx)}`;
      }).join(", ")} }`;
    case "AssignmentExpression":
      return `(${expressionToTS(expr.left, ctx)} ${expr.operator} ${expressionToTS(expr.right, ctx)})`;
    case "AwaitExpression":
      return `(await ${expressionToTS(expr.argument, ctx)})`;
  }
}

function styleValueToCSS(literal: Literal): string {
  if (literal.literalType === "number") return `"${literal.value}px"`;
  if (literal.value === null) return `"inherit"`;
  return JSON.stringify(literal.value);
}

function styleBlockToTSX(block: StyleBlock): string {
  const props = block.properties.map((p) => `${p.key}: ${styleValueToCSS(p.value)}`).join(", ");
  return `style={{ ${props} }}`;
}

function slotPropName(name?: string): string {
  if (!name) return "children";
  const safe = name.replace(/[^A-Za-z0-9_$]/g, "_");
  return `${safe}Slot`;
}

function slotToJSX(slot: Slot, ctx: CompileContext, indent: number): string {
  const pad = "  ".repeat(indent);
  const prop = slotPropName(slot.name);
  const fallback = slot.items
    .map((item) => {
      if (item.type === "Element") return elementToJSX(item, ctx, indent + 1);
      if (item.type === "IfStatement" || item.type === "ForStatement") return controlFlowToJSX(item, ctx, indent + 1);
      if (item.type === "Slot") return slotToJSX(item, ctx, indent + 1);
      return "";
    })
    .filter(Boolean)
    .join("\n");
  if (!fallback) return `${pad}{${prop}}`;
  return `${pad}{${prop} ?? (\n${pad}  <>\n${fallback}\n${pad}  </>\n${pad})}`;
}

/** Emit an assignment/update against component state through its setter. */
function stateMutationToTS(stmt: AssignmentExpression | UpdateExpression, ctx: CompileContext): string | null {
  if (stmt.type === "AssignmentExpression") {
    const left = stmt.left as Expression;
    if (left.type !== "Identifier") return null;
    const name = left.name;
    if (!ctx.stateVars.has(name)) return null;
    const right = expressionToTS(stmt.right, ctx);
    switch (stmt.operator) {
      case "=":
        return `${setterName(name)}(${right});`;
      case "+=":
        return `${setterName(name)}((current) => current + (${right}));`;
      case "-=":
        return `${setterName(name)}((current) => current - (${right}));`;
      case "*=":
        return `${setterName(name)}((current) => current * (${right}));`;
      case "/=":
        return `${setterName(name)}((current) => current / (${right}));`;
    }
  }
  if (stmt.type === "UpdateExpression" && stmt.argument.type === "Identifier") {
    const name = stmt.argument.name;
    if (!ctx.stateVars.has(name)) return null;
    const delta = stmt.operator === "++" ? "+ 1" : "- 1";
    return `${setterName(name)}((current) => current ${delta});`;
  }
  return null;
}

function statementToTS(stmt: Statement, ctx: CompileContext, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (stmt.type) {
    case "ExpressionStatement": {
      const e = stmt.expression;
      if (e.type === "AssignmentExpression" || e.type === "UpdateExpression") {
        const mutation = stateMutationToTS(e as AssignmentExpression | UpdateExpression, ctx);
        if (mutation) return pad + mutation;
      }
      return `${pad}${expressionToTS(e, ctx)};`;
    }
    case "AssignmentExpression": {
      const mutation = stateMutationToTS(stmt, ctx);
      if (mutation) return pad + mutation;
      return `${pad}${expressionToTS(stmt.left, ctx)} ${stmt.operator} ${expressionToTS(stmt.right, ctx)};`;
    }
    case "VariableDeclaration":
      return stmt.declarations
        .map((d: VariableDeclarator) => {
          const typeAnn = d.typeAnnotation ? `: ${typeAnnotationToTS(d.typeAnnotation)}` : "";
          const init = d.init ? ` = ${expressionToTS(d.init, ctx)}` : "";
          return `${pad}const ${d.id}${typeAnn}${init};`;
        })
        .join("\n");
    case "ReturnStatement": {
      const ret = stmt as ReturnStatement;
      return `${pad}return${ret.argument ? ` ${expressionToTS(ret.argument, ctx)}` : ""};`;
    }
    case "IfStatement": {
      let out = `${pad}if (${expressionToTS(stmt.test, ctx)}) {\n${blockBodyToTS(stmt.consequent.body, ctx, indent + 1)}\n${pad}}`;
      if (stmt.alternate) {
        out += ` else {\n${blockBodyToTS(stmt.alternate.body, ctx, indent + 1)}\n${pad}}`;
      }
      return out;
    }
    case "ForStatement":
      return `${pad}for (const ${stmt.variable} of ${expressionToTS(stmt.iterable, ctx)}) {\n${blockBodyToTS(stmt.body.body, ctx, indent + 1)}\n${pad}}`;
    case "TryStatement": {
      let out = `${pad}try {\n${blockBodyToTS(stmt.block.body, ctx, indent + 1)}\n${pad}}`;
      if (stmt.handler) {
        const param = stmt.handler.param ? `(${stmt.handler.param.name})` : "";
        out += ` catch ${param} {\n${blockBodyToTS(stmt.handler.body.body, ctx, indent + 1)}\n${pad}}`;
      }
      if (stmt.finalizer) {
        out += ` finally {\n${blockBodyToTS(stmt.finalizer.body, ctx, indent + 1)}\n${pad}}`;
      }
      return out;
    }
    case "EmptyStatement":
      return `${pad};`;
    default:
      return "";
  }
}

function blockBodyToTS(items: BlockItem[], ctx: CompileContext, indent: number): string {
  return items
    .map((item) => {
      if (item.type === "StateBlock" || item.type === "StyleBlock" || item.type === "Element") return "";
      return statementToTS(item, ctx, indent);
    })
    .filter(Boolean)
    .join("\n");
}

function elementToJSX(element: Element, ctx: CompileContext, indent = 2): string {
  const pad = "  ".repeat(indent);
  const attrs: string[] = [];
  const children: string[] = [];

  const paramNames = ctx.componentParams.get(element.name) ?? [];
  element.arguments.forEach((arg, index) => {
    const propName = paramNames[index] ?? `arg${index + 1}`;
    attrs.push(`${propName}={${expressionToTS(arg, ctx)}}`);
  });

  for (const item of element.items) {
    if (item.type === "Property") {
      if (item.key === "text" || item.key === "content") {
        children.push(`${pad}  {${expressionToTS(item.value, ctx)}}`);
      } else {
        attrs.push(`${item.key}={${expressionToTS(item.value, ctx)}}`);
      }
    } else if (item.type === "StyleBlock") {
      attrs.push(styleBlockToTSX(item));
    } else if (item.type === "EventBlock") {
      const handler = registerHandler(item, ctx);
      attrs.push(`${item.name}={${handler}}`);
    } else if (item.type === "Slot" && /^[A-Z]/.test(element.name)) {
      const content = item.items
        .map((child) => child.type === "Element" ? elementToJSX(child, ctx, indent + 2) : "")
        .filter(Boolean)
        .join("\n");
      const prop = slotPropName(item.name);
      attrs.push(`${prop}={<>\n${content}\n${pad}  </>}`);
    } else if (item.type === "Slot") {
      children.push(slotToJSX(item, ctx, indent + 1));
    } else if (item.type === "Element") {
      children.push(elementToJSX(item, ctx, indent + 1));
    } else if (item.type === "IfStatement" || item.type === "ForStatement") {
      children.push(controlFlowToJSX(item, ctx, indent));
    }
    // Other statements inside elements are ignored in JSX output.
  }

  const tagName = element.name === "text" ? "span" : element.name;
  const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  if (children.length === 0) {
    return `${pad}<${tagName}${attrStr} />`;
  }
  return `${pad}<${tagName}${attrStr}>\n${children.join("\n")}\n${pad}</${tagName}>`;
}

function controlFlowToJSX(
  item: IfStatement | ForStatement,
  ctx: CompileContext,
  indent: number
): string {
  const pad = "  ".repeat(indent);

  const renderItems = (items: BlockItem[], extraIndent: number): string =>
    items
      .map((child) => {
        if (child.type === "Element") return elementToJSX(child, ctx, extraIndent);
        if (child.type === "Slot") return slotToJSX(child, ctx, extraIndent);
        if (child.type === "IfStatement" || child.type === "ForStatement")
          return controlFlowToJSX(child, ctx, extraIndent);
        return "";
      })
      .filter(Boolean)
      .join("\n");

  if (item.type === "ForStatement") {
    const body = renderItems(item.body.body, indent + 1);
    return `${pad}{${expressionToTS(item.iterable, ctx)}.map((${item.variable}, index) => (\n${pad}  <div key={index}>\n${body}\n${pad}  </div>\n${pad}))}`;
  }

  const consequent = renderItems(item.consequent.body, indent + 1);
  let out = `${pad}{${expressionToTS(item.test, ctx)} ? (\n${consequent}\n${pad}`;
  if (item.alternate) {
    const alternate = renderItems(item.alternate.body, indent + 1);
    out += `) : (\n${alternate}\n${pad}`;
  } else {
    out += `) : (\n${pad}  null\n${pad}`;
  }
  return out + `)}`;
}

function registerHandler(block: EventBlock, ctx: CompileContext): string {
  const baseName = `handle${block.name.charAt(0).toUpperCase()}${block.name.slice(1)}`;
  const count = (ctx.handlerCounts.get(baseName) ?? 0) + 1;
  ctx.handlerCounts.set(baseName, count);
  const handlerName = count === 1 ? baseName : `${baseName}${count}`;
  const params = block.params.map(paramToTS).join(", ");
  const body = blockBodyToTS(block.body.body, ctx, 2);
  ctx.handlers.push(`  const ${handlerName} = (${params}) => {\n${body || "    // no-op"}\n  };`);
  return handlerName;
}

function collectStateDecls(body: BlockItem[], ctx: CompileContext): string[] {
  const decls: string[] = [];
  for (const item of body) {
    if (item.type !== "StateBlock") continue;
    for (const sv of item.variables) {
      ctx.stateVars.add(sv.id);
      const initVal = sv.init ? expressionToTS(sv.init, ctx) : "undefined";
      decls.push(`  const [${sv.id}, ${setterName(sv.id)}] = useState(${initVal});`);
    }
  }
  return decls;
}

function componentBody(component: Page | Component, ctx: CompileContext): string {
  const stateDecls = collectStateDecls(component.body, ctx);

  const jsxParts = component.body
    .map((item) => {
      if (item.type === "Element") return elementToJSX(item, ctx, 2);
      if (item.type === "Slot") return slotToJSX(item, ctx, 2);
      if (item.type === "IfStatement" || item.type === "ForStatement")
        return controlFlowToJSX(item, ctx, 2);
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const lines: string[] = [];
  lines.push(...stateDecls);
  if (ctx.handlers.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(...ctx.handlers);
  }
  const rootStyle = component.body.find((item): item is StyleBlock => item.type === "StyleBlock");
  const rootAttr = rootStyle ? ` ${styleBlockToTSX(rootStyle)}` : "";
  if (jsxParts) {
    lines.push("", "  return (", `    <div${rootAttr}>`, jsxParts, "    </div>", "  );");
  } else {
    lines.push("", "  return (", "    <div />", "  );");
  }

  return lines.join("\n");
}

function reactImport(ctx: CompileContext, needsReactNode = false): string {
  const imports: string[] = [];
  if (ctx.stateVars.size > 0) imports.push(`import { useState } from "react";`);
  if (needsReactNode) imports.push(`import type { ReactNode } from "react";`);
  return imports.join("\n");
}

function pageToTSX(page: Page, componentParams: Map<string, string[]>): string {
  const ctx = newContext(componentParams);
  const body = componentBody(page, ctx);
  const imp = reactImport(ctx);
  return `${imp}
export function ${page.name}() {
${body}
}
`;
}

function componentToTSX(component: Component, componentParams: Map<string, string[]>): string {
  const ctx = newContext(componentParams);
  const slotNames = collectSlotNames(component.body);
  const propNames = [
    ...component.params.map((p) => p.defaultValue ? `${p.name} = ${expressionToTS(p.defaultValue, ctx)}` : p.name),
    ...slotNames.map(slotPropName),
  ];
  const propTypes = [
    ...component.params.map(paramToTS),
    ...slotNames.map((name) => `${slotPropName(name)}?: ReactNode`),
  ];
  const destructure = propNames.length > 0 ? `{ ${propNames.join(", ")} }` : "";
  const propsType = propTypes.length > 0 ? `: { ${propTypes.join("; ")} }` : "";
  const body = componentBody(component, ctx);
  const imp = reactImport(ctx, slotNames.length > 0);
  return `${imp}
export function ${component.name}(${destructure}${propsType}) {
${body}
}
`;
}

function collectSlotNames(items: BlockItem[], names: Array<string | undefined> = []): Array<string | undefined> {
  for (const item of items) {
    if (item.type === "Slot") {
      if (!names.includes(item.name)) names.push(item.name);
    } else if (item.type === "Element" && !/^[A-Z]/.test(item.name)) {
      collectSlotNames(
        item.items.filter((child): child is BlockItem =>
          ["Element", "IfStatement", "ForStatement", "Slot"].includes(child.type)
        ),
        names
      );
    } else if (item.type === "IfStatement") {
      collectSlotNames(item.consequent.body, names);
      if (item.alternate) collectSlotNames(item.alternate.body, names);
    } else if (item.type === "ForStatement") {
      collectSlotNames(item.body.body, names);
    }
  }
  return names;
}

function functionToTS(fn: FunctionDeclaration): string {
  const ctx = newContext(new Map());
  const params = fn.params.map((p) => {
    const opt = p.optional ? "?" : "";
    const type = p.typeAnnotation ? `: ${typeAnnotationToTS(p.typeAnnotation)}` : ": any";
    const def = p.defaultValue ? ` = ${expressionToTS(p.defaultValue, ctx)}` : "";
    return `${p.name}${opt}${type}${def}`;
  }).join(", ");
  const returnType = fn.returnType
    ? `: ${fn.async ? `Promise<${typeAnnotationToTS(fn.returnType)}>` : typeAnnotationToTS(fn.returnType)}`
    : "";
  const body = fn.body
    .map((s) => (s.type === "StateBlock" || s.type === "StyleBlock" || s.type === "Element" ? "" : statementToTS(s, ctx, 1)))
    .filter(Boolean)
    .join("\n");
  const directive = fn.environment === "server" ? `"use server";\n\n` : fn.environment === "browser" ? `"use client";\n\n` : "";
  return `${directive}export ${fn.async ? "async " : ""}function ${fn.name}(${params})${returnType} {
${body}
}
`;
}

function typeAnnotationToJsonSchema(typeAnn: TypeAnnotation | null): any {
  if (!typeAnn) return { type: "string" }; // fallback
  
  if (typeAnn.kind === "string") return { type: "string" };
  if (typeAnn.kind === "number") return { type: "number" };
  if (typeAnn.kind === "boolean") return { type: "boolean" };
  
  if (typeAnn.kind === "array" && typeAnn.elementType) {
    return {
      type: "array",
      items: typeAnnotationToJsonSchema(typeAnn.elementType)
    };
  }
  
  if (typeAnn.kind === "object" && typeAnn.properties) {
    const properties: any = {};
    const required: string[] = [];
    for (const prop of typeAnn.properties) {
      properties[prop.name] = typeAnnotationToJsonSchema(prop.typeAnnotation);
      if (!prop.optional) required.push(prop.name);
    }
    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined
    };
  }
  
  // For references, unions, etc, fallback to string in MVP
  return { type: "string" };
}

function toolToTS(tool: import("@jgrandson/ast").ToolDeclaration): string {
  const ctx = newContext(new Map());
  const params = tool.params.map((p) => {
    const opt = p.optional ? "?" : "";
    const type = p.typeAnnotation ? `: ${typeAnnotationToTS(p.typeAnnotation)}` : ": any";
    const def = p.defaultValue ? ` = ${expressionToTS(p.defaultValue, ctx)}` : "";
    return `${p.name}${opt}${type}${def}`;
  }).join(", ");
  
  const body = tool.body
    .map((s) => (s.type === "StateBlock" || s.type === "StyleBlock" || s.type === "Element" ? "" : statementToTS(s, ctx, 1)))
    .filter(Boolean)
    .join("\n");
    
  const properties: any = {};
  const required: string[] = [];
  for (const p of tool.params) {
    properties[p.name] = typeAnnotationToJsonSchema(p.typeAnnotation);
    if (!p.optional) required.push(p.name);
  }
  
  const schema = {
    name: tool.name,
    description: tool.description || `Tool ${tool.name}`,
    parameters: {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined
    }
  };

  const schemaStr = `export const ${tool.name}Schema = ${JSON.stringify(schema, null, 2)};`;
  const fnStr = `export async function ${tool.name}(${params}) {\n${body}\n}`;
  return `${schemaStr}\n\n${fnStr}\n`;
}

function routeToTS(route: RouteDeclaration): string {
  const ctx = newContext(new Map());
  const paramExtractors = route.params.map(p => {
    const tsType = p.typeAnnotation ? typeAnnotationToTS(p.typeAnnotation) : "any";
    if (p.name === "path") return `const path = req.params as ${tsType};`;
    if (p.name === "query") return `const query = req.query as ${tsType};`;
    if (p.name === "body") return `const body = req.body as ${tsType};`;
    if (p.name === "header") return `const header = req.headers as ${tsType};`;
    return `const ${p.name} = (req as any).${p.name} as ${tsType};`;
  }).join("\n  ");

  const body = route.body
    .map((s: BlockItem) => (s.type === "StateBlock" || s.type === "StyleBlock" || s.type === "Element" ? "" : statementToTS(s as any, ctx, 1)))
    .filter(Boolean)
    .join("\n");
  
  return `export const route_${route.method.toLowerCase()} = async (req: any, res: any) => {
  ${paramExtractors}
${body}
};
`;
}

function importBindings(statement: import("@jgrandson/ast").ImportDeclaration): Array<{ local: string; source: string }> {
  const source = statement.source;
  const bindings: Array<{ local: string; source: string }> = [];
  if (statement.defaultImport) bindings.push({ local: statement.defaultImport, source });
  for (const spec of statement.specifiers ?? []) bindings.push({ local: spec.local, source });
  if (bindings.length === 0 && statement.name) bindings.push({ local: statement.name, source });
  return bindings;
}

function referencedElements(items: BlockItem[], names = new Set<string>()): Set<string> {
  for (const item of items) {
    if (item.type === "Element") {
      names.add(item.name);
      referencedElements(
        item.items.filter((child): child is BlockItem =>
          ["Element", "IfStatement", "ForStatement"].includes(child.type)
        ),
        names
      );
    } else if (item.type === "IfStatement") {
      referencedElements(item.consequent.body, names);
      if (item.alternate) referencedElements(item.alternate.body, names);
    } else if (item.type === "ForStatement") {
      referencedElements(item.body.body, names);
    }
  }
  return names;
}

function importsFor(
  ownerName: string,
  body: BlockItem[],
  localComponents: Set<string>,
  externalImports: Map<string, string>
): string {
  const names = referencedElements(body);
  const imports: string[] = [];
  for (const name of names) {
    if (name === ownerName) continue;
    if (localComponents.has(name)) {
      imports.push(`import { ${name} } from "./${name}";`);
    } else {
      const source = externalImports.get(name);
      if (source) imports.push(`import { ${name} } from ${JSON.stringify(source)};`);
    }
  }
  return imports.join("\n");
}

import { CompilerBackend, CompileResult as CResult } from "./backend";

export class ReactBackend implements CompilerBackend {
  generate(program: Program): CResult {
    const files = new Map<string, string>();
    const diagnostics: Diagnostic[] = [];
    const unwrappedBody = program.body.map(stmt => stmt.type === "ExportDeclaration" ? stmt.declaration : stmt);
    const componentParams = new Map(
      unwrappedBody
        .filter((stmt): stmt is Component => stmt.type === "Component")
        .map((component) => [component.name, component.params.map((param) => param.name)])
    );
    const localComponents = new Set(componentParams.keys());
    const externalImports = new Map(
      unwrappedBody
        .filter((stmt) => stmt.type === "ImportDeclaration")
        .flatMap((stmt) => importBindings(stmt).map((binding) => [binding.local, binding.source] as const))
    );

    for (let stmt of program.body) {
      if (stmt.type === "ExportDeclaration") {
        stmt = stmt.declaration;
      }
      if (stmt.type === "Page") {
        const imports = importsFor(stmt.name, stmt.body, localComponents, externalImports);
        files.set(`${stmt.name}.tsx`, `${imports}${imports ? "\n" : ""}${pageToTSX(stmt, componentParams)}`);
      } else if (stmt.type === "Component") {
        const imports = importsFor(stmt.name, stmt.body, localComponents, externalImports);
        files.set(`${stmt.name}.tsx`, `${imports}${imports ? "\n" : ""}${componentToTSX(stmt, componentParams)}`);
      } else if (stmt.type === "RouteDeclaration") {
        const sanitized = stmt.path.replace(/[^a-zA-Z0-9]/g, "_");
        files.set(`route_${stmt.method.toLowerCase()}_${sanitized}.ts`, routeToTS(stmt));
      } else if (stmt.type === "ToolDeclaration") {
        files.set(`${stmt.name}.ts`, toolToTS(stmt));
      } else if (stmt.type === "FunctionDeclaration") {
        files.set(`${stmt.name}.ts`, functionToTS(stmt));
      } else if (stmt.type === "TypeAliasDeclaration") {
        files.set(`${stmt.name}.ts`, `export type ${stmt.name} = ${typeAnnotationToTS(stmt.typeAnnotation)};\n`);
      } else if (stmt.type === "InterfaceDeclaration") {
        const props = stmt.properties
          .map((p) => `  ${p.name}${p.optional ? "?" : ""}: ${typeAnnotationToTS(p.typeAnnotation)};`)
          .join("\n");
        files.set(`${stmt.name}.ts`, `export interface ${stmt.name} {\n${props}\n}\n`);
      }
    }

    const openApiPaths: any = {};
    const routes = unwrappedBody.filter((stmt): stmt is import("@jgrandson/ast").RouteDeclaration => stmt.type === "RouteDeclaration");
    
    for (const route of routes) {
      if (!openApiPaths[route.path]) openApiPaths[route.path] = {};
      const method = route.method.toLowerCase();
      openApiPaths[route.path][method] = {
        summary: `Handler for ${route.method} ${route.path}`,
        responses: {
          "200": { description: "Successful response" }
        }
      };
    }
    
    if (routes.length > 0) {
      const openApiSchema = {
        openapi: "3.0.0",
        info: { title: "JGrandson API", version: "1.0.0" },
        paths: openApiPaths
      };
      files.set("openapi.json", JSON.stringify(openApiSchema, null, 2));
    }

    return { files, diagnostics };
  }
}
