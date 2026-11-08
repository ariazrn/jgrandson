import type {
  BlockItem,
  Component,
  Diagnostic,
  Element,
  Expression,
  FunctionDeclaration,
  Page,
  Program,
  SourceLocation,
  Statement,
  TypeAnnotation,
  Parameter,
} from "@jgrandson/ast";

export interface AnalyzeResult {
  diagnostics: Diagnostic[];
}

export * from "./explain";
export * from "./provenance";
export * from "./effects";
export * from "./workflow";
export * from "./ai-authority";
export * from "./impact";
export * from "./ux-contract";
import { checkProvenance } from "./provenance";
import { checkUxContracts } from "./ux-contract";

export interface ProjectModule {
  /** Stable absolute or project-relative module identifier. */
  id: string;
  program: Program;
  /** Import source string to resolved module id; undefined means unresolved. */
  imports: Map<string, string | undefined>;
}

export interface ProjectAnalyzeResult {
  diagnosticsByModule: Map<string, Diagnostic[]>;
}

type ValueType = TypeAnnotation["kind"] | "unknown";

interface ParameterSymbol {
  name: string;
  type: ValueType;
  typeAnnotation: TypeAnnotation;
  optional?: boolean;
  hasDefault?: boolean;
}

interface SymbolInfo {
  kind: "variable" | "state" | "parameter" | "function" | "component" | "page" | "import" | "type";
  type: ValueType;
  params?: ParameterSymbol[];
  returnType?: ValueType;
  slots?: Array<string | undefined>;
}

const GLOBAL_DOM_PROPERTIES = new Set([
  "accessKey",
  "ariaLabel",
  "class",
  "className",
  "content",
  "dir",
  "draggable",
  "hidden",
  "id",
  "lang",
  "role",
  "tabIndex",
  "text",
  "title",
]);

const DOM_PROPERTIES_BY_ELEMENT = new Map<string, Set<string>>([
  ["a", new Set(["download", "href", "rel", "target"])],
  ["button", new Set(["disabled", "name", "type", "value"])],
  ["form", new Set(["action", "method", "name", "noValidate"])],
  ["img", new Set(["alt", "height", "src", "width"])],
  ["input", new Set(["checked", "disabled", "max", "min", "name", "placeholder", "type", "value"])],
  ["label", new Set(["htmlFor"])],
  ["ol", new Set(["start", "type"])],
  ["option", new Set(["disabled", "label", "selected", "value"])],
  ["textarea", new Set(["disabled", "name", "placeholder", "rows", "value"])],
]);

const KNOWN_DOM_EVENTS = new Set(["onClick", "onInput", "onChange", "onSubmit", "onFocus", "onBlur"]);
const DOM_EVENT_PARAM_TYPES = new Map<string, TypeAnnotation["kind"]>([
  ["onInput", "string"],
  ["onChange", "string"],
  ["onClick", "object"],
  ["onSubmit", "object"],
  ["onFocus", "object"],
  ["onBlur", "object"],
]);

class Scope {
  private readonly symbols = new Map<string, SymbolInfo>();

  constructor(private readonly parent?: Scope) {}

  declare(name: string, symbol: SymbolInfo): boolean {
    if (this.symbols.has(name)) return false;
    this.symbols.set(name, symbol);
    return true;
  }

  lookup(name: string): SymbolInfo | undefined {
    return this.symbols.get(name) ?? this.parent?.lookup(name);
  }
}

const typeKind = (annotation: TypeAnnotation | null | undefined): ValueType => annotation?.kind ?? "unknown";

class Analyzer {
  readonly diagnostics: Diagnostic[] = [];
  private readonly global = new Scope();

  constructor(
    private readonly program: Program,
    private readonly resolvedImports = new Map<string, SymbolInfo>()
  ) {}

  run(): AnalyzeResult {
    this.declareTopLevel();
    for (let statement of this.program.body) {
      if (statement.type === "ExportDeclaration") {
        statement = statement.declaration;
      }
      if (statement.type === "Page" || statement.type === "Component") this.analyzeRenderable(statement);
      if (statement.type === "FunctionDeclaration") this.analyzeFunction(statement);
    }
    return { diagnostics: this.diagnostics };
  }

  private report(code: string, message: string, loc: SourceLocation): void {
    this.diagnostics.push({ code, message, severity: "error", loc });
  }

  private declareTopLevel(): void {
    for (let statement of this.program.body) {
      if (statement.type === "ExportDeclaration") {
        statement = statement.declaration;
      }
      let symbol: SymbolInfo;
      let name: string;
      if (statement.type === "ImportDeclaration") {
        if (statement.defaultImport) {
          const defaultSymbol = this.resolvedImports.get(statement.defaultImport) ?? { kind: "import", type: "unknown" };
          this.declare(this.global, statement.defaultImport, defaultSymbol, statement.loc);
        }
        if (statement.specifiers) {
          for (const spec of statement.specifiers) {
            const specSymbol = this.resolvedImports.get(spec.local) ?? { kind: "import", type: "unknown" };
            this.declare(this.global, spec.local, specSymbol, spec.loc);
          }
        }
        // Fallback for missing name handling
        if (statement.name && !statement.defaultImport && (!statement.specifiers || statement.specifiers.length === 0)) {
           const fallSymbol = this.resolvedImports.get(statement.name) ?? { kind: "import", type: "unknown" };
           this.declare(this.global, statement.name, fallSymbol, statement.loc);
        }
        continue;
      } else if (statement.type === "FunctionDeclaration") {
        name = statement.name;
        symbol = {
          kind: "function",
          type: "unknown",
          params: statement.params.map(toParameterSymbol),
          returnType: typeKind(statement.returnType),
        };
      } else if (statement.type === "Component") {
        name = statement.name;
        symbol = {
          kind: "component",
          type: "unknown",
          params: statement.params.map(toParameterSymbol),
          slots: declaredSlots(statement.body),
        };
      } else if (statement.type === "RouteDeclaration") {
        name = `${statement.method} ${statement.path}`;
        symbol = { kind: "function", type: "unknown", params: statement.params.map(toParameterSymbol) };
      } else if (statement.type === "ToolDeclaration") {
        name = statement.name;
        symbol = { kind: "function", type: "unknown", params: statement.params.map(toParameterSymbol) };
      } else if (statement.type === "TypeAliasDeclaration") {
        name = statement.name;
        symbol = { kind: "type", type: typeKind(statement.typeAnnotation) };
      } else if (statement.type === "InterfaceDeclaration") {
        name = statement.name;
        symbol = { kind: "type", type: "object" };
      } else {
        name = (statement as Page).name;
        symbol = { kind: "page", type: "unknown", params: [] };
      }
      if (!this.global.declare(name, symbol)) {
        this.report("DUPLICATE_DECLARATION", `Duplicate top-level declaration '${name}'`, statement.loc);
      }
    }
  }

  private analyzeRenderable(node: Page | Component): void {
    const scope = new Scope(this.global);
    if (node.type === "Component") {
      this.analyzeParameters(node.params, scope);
    }
    this.analyzeItems(node.body, scope, null);
  }

  private analyzeFunction(node: FunctionDeclaration): void {
    const scope = new Scope(this.global);
    this.analyzeParameters(node.params, scope);
    this.analyzeItems(node.body, scope, typeKind(node.returnType));
  }

  private analyzeParameters(params: Parameter[], scope: Scope): void {
    let hasOptional = false;
    for (const param of params) {
      if (param.optional || param.defaultValue) {
        hasOptional = true;
      } else if (hasOptional) {
        this.report("PARAMETER_ORDER", "A required parameter cannot follow an optional parameter", param.loc);
      }
      this.declare(scope, param.name, { kind: "parameter", type: typeKind(param.typeAnnotation) }, param.loc);
    }
  }

  private declare(scope: Scope, name: string, symbol: SymbolInfo, loc: SourceLocation): void {
    if (!scope.declare(name, symbol)) {
      this.report("DUPLICATE_DECLARATION", `Duplicate declaration '${name}'`, loc);
    }
  }

  private analyzeItems(items: BlockItem[], scope: Scope, returnType: ValueType | null): void {
    for (const item of items) this.analyzeStatement(item, scope, returnType);
  }

  private analyzeStatement(item: Statement, scope: Scope, returnType: ValueType | null): void {
    switch (item.type) {
      case "StateBlock":
        for (const variable of item.variables) {
          const declaredType = typeKind(variable.typeAnnotation);
          const actualType = variable.init ? this.expressionType(variable.init, scope) : "unknown";
          this.checkAssignable(variable.typeAnnotation ?? declaredType, actualType, variable.loc);
          this.declare(scope, variable.id, { kind: "state", type: declaredType }, variable.loc);
        }
        break;
      case "VariableDeclaration":
        for (const declaration of item.declarations) {
          const actualType = declaration.init ? this.expressionType(declaration.init, scope) : "unknown";
          const declaredType = typeKind(declaration.typeAnnotation);
          this.checkAssignable(declaration.typeAnnotation ?? declaredType, actualType, declaration.loc);
          this.declare(scope, declaration.id, {
            kind: "variable",
            type: declaredType === "unknown" ? actualType : declaredType,
          }, declaration.loc);
        }
        break;
      case "Element":
        this.analyzeElement(item, scope, returnType);
        break;
      case "ExpressionStatement":
        this.expressionType(item.expression, scope);
        break;
      case "AssignmentExpression":
      case "UpdateExpression":
        this.expressionType(item, scope);
        break;
      case "IfStatement":
        this.expressionType(item.test, scope);
        this.analyzeItems(item.consequent.body, new Scope(scope), returnType);
        if (item.alternate) this.analyzeItems(item.alternate.body, new Scope(scope), returnType);
        break;
      case "ForStatement": {
        this.expressionType(item.iterable, scope);
        const loopScope = new Scope(scope);
        loopScope.declare(item.variable, { kind: "variable", type: "unknown" });
        this.analyzeItems(item.body.body, loopScope, returnType);
        break;
      }
      case "TryStatement": {
        this.analyzeItems(item.block.body, new Scope(scope), returnType);
        if (item.handler) {
          const catchScope = new Scope(scope);
          if (item.handler.param) {
            this.declare(catchScope, item.handler.param.name, { kind: "variable", type: "unknown" }, item.handler.param.loc);
          }
          this.analyzeItems(item.handler.body.body, catchScope, returnType);
        }
        if (item.finalizer) {
          this.analyzeItems(item.finalizer.body, new Scope(scope), returnType);
        }
        break;
      }
      case "ReturnStatement": {
        const actual = item.argument ? this.expressionType(item.argument, scope) : "void";
        if (returnType === null) this.report("INVALID_RETURN", "Return is only valid inside a function", item.loc);
        else this.checkAssignable(returnType, actual, item.loc);
        break;
      }
      case "Slot":
        this.analyzeSlot(item, scope, returnType);
        break;
      case "StyleBlock":
      case "EmptyStatement":
        break;
    }
  }

  private analyzeElement(element: Element, scope: Scope, returnType: ValueType | null): void {
    if (/^[A-Z]/.test(element.name)) {
      const symbol = scope.lookup(element.name);
      if (!symbol || !["component", "import"].includes(symbol.kind)) {
        this.report("UNKNOWN_COMPONENT", `Unknown component '${element.name}'`, element.loc);
      } else if (symbol.params) {
        const minArgs = symbol.params.filter((p) => !p.optional && !p.hasDefault).length;
        const maxArgs = symbol.params.length;
        if (element.arguments.length < minArgs || element.arguments.length > maxArgs) {
          const expected = minArgs === maxArgs ? `${minArgs}` : `${minArgs} to ${maxArgs}`;
          this.report(
            "ARGUMENT_COUNT",
            `Component '${element.name}' expects ${expected} argument(s), received ${element.arguments.length}`,
            element.loc
          );
        }
      }
      element.arguments.forEach((argument, index) => {
        const actual = this.expressionType(argument, scope);
        const expected = symbol?.params?.[index];
        if (expected) this.checkAssignable(expected.typeAnnotation, actual, argument.loc);
      });
      const suppliedNamed = new Set<string>();
      const directChildren = element.items.some((item) => item.type === "Element");
      if (directChildren && symbol?.slots && !symbol.slots.includes(undefined)) {
        this.report("UNKNOWN_SLOT", `Component '${element.name}' does not declare a default slot`, element.loc);
      }
      for (const item of element.items) {
        if (item.type !== "Slot") continue;
        const key = item.name ?? "children";
        if (suppliedNamed.has(key)) {
          this.report("DUPLICATE_SLOT", `Slot '${key}' is supplied more than once`, item.loc);
        }
        suppliedNamed.add(key);
        if (symbol?.slots && !symbol.slots.includes(item.name)) {
          this.report("UNKNOWN_SLOT", `Component '${element.name}' does not declare slot '${key}'`, item.loc);
        }
      }
    } else {
      this.validateDomElement(element);
      element.arguments.forEach((argument) => this.expressionType(argument, scope));
    }

    for (const item of element.items) {
      if (item.type === "Property") this.expressionType(item.value, scope);
      else if (item.type === "EventBlock") {
        if (!KNOWN_DOM_EVENTS.has(item.name)) {
          this.report("UNKNOWN_EVENT", `Unknown event '${item.name}' on '${element.name}'`, item.loc);
        }
        const handlerScope = new Scope(scope);
        for (const param of item.params) {
          const inferred = param.typeAnnotation ?? eventParameterType(item.name, param.loc);
          this.declare(handlerScope, param.name, { kind: "parameter", type: typeKind(inferred) }, param.loc);
        }
        this.analyzeItems(item.body.body, handlerScope, returnType);
      } else {
        this.analyzeStatement(item, scope, returnType);
      }
    }
  }

  private validateDomElement(element: Element): void {
    if (element.name.includes("-")) return;
    const tagSpecific = DOM_PROPERTIES_BY_ELEMENT.get(element.name);
    const propertyKeys = new Set(element.items.filter((item) => item.type === "Property").map((item) => item.key));
    if (element.name === "img" && !propertyKeys.has("alt")) {
      this.report("A11Y_MISSING_ALT", "Image elements require an alt property", element.loc);
    }
    if (element.name === "button" && !propertyKeys.has("text") && !propertyKeys.has("content") && !propertyKeys.has("ariaLabel")) {
      this.report("A11Y_BUTTON_NAME", "Button elements require text, content, or ariaLabel", element.loc);
    }
    for (const item of element.items) {
      if (item.type !== "Property") continue;
      if (isAllowedDomProperty(item.key, tagSpecific)) continue;
      this.report("UNKNOWN_PROPERTY", `Unknown property '${item.key}' on '${element.name}'`, item.loc);
    }
  }

  private analyzeSlot(slot: import("@jgrandson/ast").Slot, scope: Scope, returnType: ValueType | null): void {
    for (const item of slot.items) {
      if (item.type === "Property") this.expressionType(item.value, scope);
      else if (item.type === "EventBlock") {
        const handlerScope = new Scope(scope);
        for (const param of item.params) {
          const inferred = param.typeAnnotation ?? eventParameterType(item.name, param.loc);
          this.declare(handlerScope, param.name, { kind: "parameter", type: typeKind(inferred) }, param.loc);
        }
        this.analyzeItems(item.body.body, handlerScope, returnType);
      } else {
        this.analyzeStatement(item, scope, returnType);
      }
    }
  }

  private expressionType(expression: Expression, scope: Scope): ValueType {
    switch (expression.type) {
      case "Literal":
        return expression.literalType;
      case "Identifier": {
        const symbol = scope.lookup(expression.name);
        if (!symbol) {
          this.report("UNKNOWN_IDENTIFIER", `Unknown identifier '${expression.name}'`, expression.loc);
          return "unknown";
        }
        return symbol.type;
      }
      case "ArrayLiteral":
        expression.elements.forEach((element) => {
          if (element.type === "SpreadElement") this.expressionType(element.argument, scope);
          else this.expressionType(element, scope);
        });
        return "array";
      case "ObjectLiteral":
        expression.properties.forEach((property) => {
          if ("type" in property && property.type === "SpreadElement") this.expressionType((property as any).argument, scope);
          else this.expressionType((property as any).value, scope);
        });
        return "object";
      case "AwaitExpression":
        this.expressionType(expression.argument, scope);
        return "unknown";
      case "UnaryExpression":
        this.expressionType(expression.argument, scope);
        return expression.operator === "!" ? "boolean" : "number";
      case "BinaryExpression": {
        const left = this.expressionType(expression.left, scope);
        const right = this.expressionType(expression.right, scope);
        if (["==", "===", "!=", "<", ">", "<=", ">="].includes(expression.operator)) return "boolean";
        if (expression.operator === "+" && (left === "string" || right === "string")) return "string";
        return "number";
      }
      case "LogicalExpression":
        this.expressionType(expression.left, scope);
        this.expressionType(expression.right, scope);
        return "boolean";
      case "AssignmentExpression": {
        const target = this.expressionType(expression.left, scope);
        const value = this.expressionType(expression.right, scope);
        this.checkAssignable(target, value, expression.loc);
        return target;
      }
      case "UpdateExpression": {
        const target = this.expressionType(expression.argument, scope);
        if (target !== "number" && target !== "unknown") {
          this.report("TYPE_MISMATCH", "Update operators require a number", expression.loc);
        }
        return "number";
      }
      case "MemberExpression":
        this.expressionType(expression.object, scope);
        if (expression.computed) this.expressionType(expression.property, scope);
        return "unknown";
      case "CallExpression": {
        const argumentTypes = expression.args.map((argument) => this.expressionType(argument, scope));
        if (expression.callee.type !== "Identifier") {
          this.expressionType(expression.callee, scope);
          return "unknown";
        }
        const symbol = scope.lookup(expression.callee.name);
        if (!symbol) {
          this.report("UNKNOWN_FUNCTION", `Unknown function '${expression.callee.name}'`, expression.callee.loc);
          return "unknown";
        }
        if (symbol.kind !== "function" && symbol.kind !== "import") {
          this.report("NOT_CALLABLE", `'${expression.callee.name}' is not callable`, expression.callee.loc);
          return "unknown";
        }
        if (symbol.params) {
          const minArgs = symbol.params.filter((p) => !p.optional && !p.hasDefault).length;
          const maxArgs = symbol.params.length;
          if (expression.args.length < minArgs || expression.args.length > maxArgs) {
            const expected = minArgs === maxArgs ? `${minArgs}` : `${minArgs} to ${maxArgs}`;
            this.report(
              "ARGUMENT_COUNT",
              `Function '${expression.callee.name}' expects ${expected} argument(s), received ${expression.args.length}`,
              expression.loc
            );
          }
        }
        expression.args.forEach((argument, index) => {
          const expected = symbol.params?.[index];
          if (expected) this.checkAssignable(expected.typeAnnotation, argumentTypes[index] ?? "unknown", argument.loc);
        });
        return symbol.returnType ?? "unknown";
      }
    }
  }

  private checkAssignable(expected: TypeAnnotation | ValueType, actual: ValueType, loc: SourceLocation): void {
    if (!isCompatible(expected, actual)) {
      this.report("TYPE_MISMATCH", `Expected ${typeToString(expected)}, received ${actual}`, loc);
    }
  }
}

function typeToString(type: TypeAnnotation | ValueType): string {
  if (typeof type === "string") return type;
  if (type.kind === "union" && type.types) {
    return type.types.map(typeToString).join(" | ");
  }
  if (type.kind === "array" && type.elementType) {
    return `${typeToString(type.elementType)}[]`;
  }
  if (type.kind === "reference" && type.refName) {
    return type.refName;
  }
  return type.kind;
}

function isCompatible(expected: TypeAnnotation | ValueType, actual: ValueType): boolean {
  if (actual === "unknown" || actual === "any") return true;
  if (typeof expected === "string") {
    if (expected === "unknown" || expected === "any") return true;
    return expected === actual;
  }
  if (expected.kind === "any") return true;
  if (expected.kind === "union" && expected.types) {
    return expected.types.some((branch) => isCompatible(branch, actual));
  }
  if (expected.kind === "reference") {
    return actual === "object" || actual === "reference" || actual === expected.refName;
  }
  return expected.kind === actual;
}

function toParameterSymbol(param: Parameter): ParameterSymbol {
  const annotation = param.typeAnnotation ?? unknownType(param.loc);
  return {
    name: param.name,
    type: typeKind(annotation),
    typeAnnotation: annotation,
    ...(param.optional ? { optional: true } : {}),
    ...(param.defaultValue ? { hasDefault: true } : {}),
  };
}

function unknownType(loc: SourceLocation): TypeAnnotation {
  return { kind: "any", loc };
}

function eventParameterType(eventName: string, loc: SourceLocation): TypeAnnotation {
  return { kind: DOM_EVENT_PARAM_TYPES.get(eventName) ?? "any", loc };
}

function isAllowedDomProperty(key: string, tagSpecific: Set<string> | undefined): boolean {
  return GLOBAL_DOM_PROPERTIES.has(key)
    || tagSpecific?.has(key)
    || key.startsWith("aria-")
    || key.startsWith("data-");
}

export function analyze(program: Program): AnalyzeResult {
  return new Analyzer(program).run();
}

function importBindings(statement: import("@jgrandson/ast").ImportDeclaration): Array<{ imported: string; local: string }> {
  const bindings: Array<{ imported: string; local: string }> = [];
  if (statement.defaultImport) bindings.push({ imported: statement.defaultImport, local: statement.defaultImport });
  for (const spec of statement.specifiers ?? []) bindings.push({ imported: spec.imported, local: spec.local });
  if (bindings.length === 0 && statement.name) bindings.push({ imported: statement.name, local: statement.name });
  return bindings;
}

function symbolForExport(
  statement: Program["body"][number]
): SymbolInfo | undefined {
  if (statement.type === "ExportDeclaration") {
    statement = statement.declaration;
  }
  if (statement.type === "FunctionDeclaration") {
    return {
      kind: "function",
      type: "unknown",
      params: statement.params.map(toParameterSymbol),
      returnType: typeKind(statement.returnType),
    };
  }
  if (statement.type === "Component") {
    return {
      kind: "component",
      type: "unknown",
      params: statement.params.map(toParameterSymbol),
      slots: declaredSlots(statement.body),
    };
  }
  if (statement.type === "TypeAliasDeclaration" || statement.type === "InterfaceDeclaration") {
    return { kind: "type", type: "unknown" };
  }
  if (statement.type === "Page") return { kind: "page", type: "unknown", params: [] };
  return undefined;
}

function declaredSlots(items: BlockItem[], names: Array<string | undefined> = []): Array<string | undefined> {
  for (const item of items) {
    if (item.type === "Slot") {
      if (!names.includes(item.name)) names.push(item.name);
    } else if (item.type === "Element" && !/^[A-Z]/.test(item.name)) {
      declaredSlots(
        item.items.filter((child): child is BlockItem =>
          ["Element", "IfStatement", "ForStatement", "Slot"].includes(child.type)
        ),
        names
      );
    } else if (item.type === "IfStatement") {
      declaredSlots(item.consequent.body, names);
      if (item.alternate) declaredSlots(item.alternate.body, names);
    } else if (item.type === "ForStatement") {
      declaredSlots(item.body.body, names);
    }
  }
  return names;
}

/** Analyze semantic rules and resolved imports across a complete project graph. */
export function analyzeProject(modules: ProjectModule[]): ProjectAnalyzeResult {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const diagnosticsByModule = new Map<string, Diagnostic[]>();
  const adjacency = new Map<string, string[]>();

  for (const module of modules) {
    const diagnostics: Diagnostic[] = [];
    const resolvedSymbols = new Map<string, SymbolInfo>();
    const edges: string[] = [];
    for (const statement of module.program.body) {
      if (statement.type !== "ImportDeclaration") continue;
      const targetId = module.imports.get(statement.source);
      const target = targetId ? byId.get(targetId) : undefined;
      if (!target) {
        diagnostics.push({
          code: "MISSING_IMPORT",
          message: `Cannot resolve import '${statement.source}'`,
          severity: "error",
          loc: statement.loc,
        });
        continue;
      }
      edges.push(target.id);
      for (const binding of importBindings(statement)) {
        const exported = target.program.body.find((candidate) => {
          if (candidate.type === "ExportDeclaration") candidate = candidate.declaration;
          return candidate.type !== "ImportDeclaration" && (candidate as any).name === binding.imported;
        });
        const symbol = exported ? symbolForExport(exported) : undefined;
        if (!symbol) {
          diagnostics.push({
            code: "MISSING_EXPORT",
            message: `Module '${statement.source}' does not export '${binding.imported}'`,
            severity: "error",
            loc: statement.loc,
          });
        } else {
          resolvedSymbols.set(binding.local, symbol);
        }
      }
    }
    adjacency.set(module.id, edges);
    diagnostics.push(...new Analyzer(module.program, resolvedSymbols).run().diagnostics);
    diagnostics.push(...checkProvenance(module.program));
    diagnostics.push(...checkUxContracts(module.program));
    diagnosticsByModule.set(module.id, diagnostics);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const reportedCycles = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id];
      const key = [...new Set(cycle)].sort().join("|");
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        const module = byId.get(id);
        const firstImport = module?.program.body.find((item) => item.type === "ImportDeclaration");
        if (module && firstImport) {
          diagnosticsByModule.get(id)?.push({
            code: "CIRCULAR_IMPORT",
            message: `Circular import detected: ${cycle.join(" -> ")}`,
            severity: "error",
            loc: firstImport.loc,
          });
        }
      }
      return;
    }
    visiting.add(id);
    stack.push(id);
    for (const dependency of adjacency.get(id) ?? []) visit(dependency);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const module of modules) visit(module.id);
  return { diagnosticsByModule };
}

export { lintProgram } from "./linter.js";
