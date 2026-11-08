import type {
  Program,
  ImportDeclaration,
  Page,
  Component,
  FunctionDeclaration,
  StateBlock,
  StyleBlock,
  StyleProperty,
  Element,
  RouteDeclaration,
  Property,
  EventBlock,
  IfStatement,
  ForStatement,
  BlockStatement,
  AiBlock,
  ToolDeclaration,
  ReturnStatement,
  AssignmentExpression,
  BinaryExpression,
  LogicalExpression,
  UnaryExpression,
  UpdateExpression,
  Identifier,
  Literal,
  VariableDeclaration,
  VariableDeclarator,
  KeyedProperty,
  StateVariable,
  Parameter,
  TypeAnnotation,
  SourceLocation,
  TopLevelStatement,
  BlockItem,
  ElementItem,
  Expression,
  Diagnostic,
  Slot,
  TypeAliasDeclaration,
  InterfaceDeclaration,
  ObjectTypeProperty,
  ExportDeclaration,
  ImportSpecifier,
  TryStatement,
  CatchClause,
  SpreadElement
} from "@jgrandson/ast";

import { tokenize, SourceError, formatSourceError, type Token, type TokenType } from "@jgrandson/lexer";

export { SourceError, formatSourceError };

export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
}

const PRIMITIVE_TYPES = new Set(["string", "number", "boolean", "void", "any", "object", "null"]);

/** Anything that can appear inside a block or element body. */
type AnyItem = BlockItem | Property | EventBlock;

class Parser {
  private current = 0;
  readonly diagnostics: Diagnostic[] = [];

  constructor(
    private readonly tokens: Token[],
    private readonly sourceName: string,
    private readonly sourceLength: number
  ) {}

  // -- token helpers ------------------------------------------------------

  private peek(offset = 0): Token {
    const i = this.current + offset;
    return this.tokens[Math.min(i, this.tokens.length - 1)];
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.tokens[0];
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    if (types.includes(this.peek().type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    return this.fail(message, this.peek());
  }

  private fail(message: string, token: Token): never {
    const diag: Diagnostic = {
      code: "PARSE_ERROR",
      message,
      severity: "error",
      loc: { start: token.start, end: token.end },
    };
    this.diagnostics.push(diag);
    throw new SyntaxError(message);
  }

  private skipNewlines(): void {
    while (this.check("Newline")) this.advance();
  }

  private loc(start: Token): SourceLocation {
    return { start: start.start, end: this.previous().end };
  }

  // -- entry point --------------------------------------------------------

  parse(): ParseResult {
    const body: TopLevelStatement[] = [];
    while (!this.isAtEnd()) {
      try {
        this.skipNewlines();
        if (this.isAtEnd()) break;
        body.push(this.topLevel());
      } catch {
        this.synchronize();
      }
    }
    const program: Program = {
      type: "Program",
      body,
      sourceName: this.sourceName,
      diagnostics: this.diagnostics.length > 0 ? [...this.diagnostics] : undefined,
      loc: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: this.sourceLength, line: 1, column: 1 },
      },
    };
    return { program, diagnostics: this.diagnostics };
  }

  private synchronize(): void {
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (
        t.type === "Keyword" &&
        ["page", "component", "function", "type", "interface", "let", "if", "for", "return", "state", "style"].includes(t.value)
      ) {
        return;
      }
      this.advance();
    }
  }

  // -- declarations -------------------------------------------------------

  private topLevel(): TopLevelStatement {
    const t = this.peek();
    if (t.type === "Keyword") {
      switch (t.value) {
        case "page": return this.pageDecl();
        case "component": return this.componentDecl();
        case "function": return this.functionDecl();
        case "route": return this.routeDecl();
        case "tool": return this.toolDecl();
        case "type": return this.typeAliasDecl();
        case "interface": return this.interfaceDecl();
        case "export": return this.exportDecl();
      }
      if (t.value === "async" && this.peek(1).type === "Keyword" && this.peek(1).value === "function") {
        return this.functionDecl();
      }
      if (["server", "browser", "shared"].includes(t.value)) {
        return this.functionDecl();
      }
    }
    if (t.type === "Ident" && t.value === "import") {
      return this.importDecl();
    }
    return this.fail("Expected top-level declaration", t);
  }

  private exportDecl(): ExportDeclaration {
    const start = this.advance(); // export
    const declaration = this.topLevel();
    return { type: "ExportDeclaration", declaration, loc: this.loc(start) };
  }

  private typeAliasDecl(): TypeAliasDeclaration {
    const start = this.advance(); // type
    const name = this.consume("Ident", "Expected type alias name").value;
    this.consume("Eq", "Expected '=' after type alias name");
    const typeAnnotation = this.typeAnnotation();
    return { type: "TypeAliasDeclaration", name, typeAnnotation, loc: this.loc(start) };
  }

  private interfaceDecl(): InterfaceDeclaration {
    const start = this.advance(); // interface
    const name = this.consume("Ident", "Expected interface name").value;
    this.consume("LBrace", "Expected '{' after interface name");
    const properties: ObjectTypeProperty[] = [];
    this.skipNewlines();
    while (!this.check("RBrace") && !this.isAtEnd()) {
      const propStart = this.peek();
      const propName = this.consume("Ident", "Expected property name").value;
      const optional = this.match("Question");
      this.consume("Colon", "Expected ':' after property name");
      const propType = this.typeAnnotation();
      properties.push({
        name: propName,
        typeAnnotation: propType,
        ...(optional ? { optional: true } : {}),
        loc: this.loc(propStart),
      });
      this.skipNewlines();
      if (this.match("Comma") || this.match("Semicolon")) {
        this.skipNewlines();
      }
    }
    this.consume("RBrace", "Expected '}' to close interface");
    return { type: "InterfaceDeclaration", name, properties, loc: this.loc(start) };
  }

  private importDecl(): ImportDeclaration {
    const start = this.advance(); // import
    let defaultImport: string | null = null;
    let specifiers: ImportSpecifier[] = [];
    
    if (this.check("Ident") && this.peek().value !== "from") {
      defaultImport = this.advance().value;
      if (this.match("Comma")) {
        this.consume("LBrace", "Expected '{' for named imports");
        specifiers = this.importSpecifiers();
      }
    } else if (this.match("LBrace")) {
      specifiers = this.importSpecifiers();
    }
    
    const from = this.consume("Ident", "Expected 'from' in import declaration");
    if (from.value !== "from") this.fail("Expected 'from' in import declaration", from);
    const source = this.consume("String", "Expected module source string").value;
    
    return { 
      type: "ImportDeclaration", 
      name: defaultImport || (specifiers.length > 0 ? specifiers[0].local : ""), // Keep name for backward compatibility
      defaultImport,
      specifiers,
      source, 
      loc: this.loc(start) 
    };
  }

  private importSpecifiers(): ImportSpecifier[] {
    const specifiers: ImportSpecifier[] = [];
    this.skipNewlines();
    while (!this.check("RBrace") && !this.isAtEnd()) {
      const specStart = this.peek();
      const imported = this.consume("Ident", "Expected imported name").value;
      let local = imported;
      if (this.peek().type === "Ident" && this.peek().value === "as") {
        this.advance(); // as
        local = this.consume("Ident", "Expected local alias after 'as'").value;
      }
      specifiers.push({
        type: "ImportSpecifier",
        imported,
        local,
        loc: this.loc(specStart),
      });
      this.skipNewlines();
      if (!this.match("Comma")) break;
      this.skipNewlines();
    }
    this.consume("RBrace", "Expected '}' to close named imports");
    return specifiers;
  }

  private pageDecl(): Page {
    const start = this.advance(); // page
    const name = this.consume("Ident", "Expected page name").value;
    this.consume("LBrace", "Expected '{' after page name");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close page");
    return { type: "Page", name, body, loc: this.loc(start) };
  }

  private componentDecl(): Component {
    const start = this.advance(); // component
    const name = this.consume("Ident", "Expected component name").value;
    const params = this.paramList();
    this.consume("LBrace", "Expected '{' after component signature");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close component");
    return { type: "Component", name, params, body, loc: this.loc(start) };
  }

  private functionDecl(): FunctionDeclaration {
    const start = this.peek();
    let environment: "server" | "browser" | "shared" | undefined = undefined;
    if (this.peek().type === "Keyword" && ["server", "browser", "shared"].includes(this.peek().value)) {
      environment = this.advance().value as any;
    }
    const isAsync = this.peek().type === "Keyword" && this.peek().value === "async";
    if (isAsync) this.advance();
    const functionToken = this.consume("Keyword", "Expected 'function'");
    if (functionToken.value !== "function") this.fail("Expected 'function'", functionToken);
    const name = this.consume("Ident", "Expected function name").value;
    const params = this.paramList();
    const returnType = this.match("Colon") ? this.typeAnnotation() : null;
    this.consume("LBrace", "Expected '{' after function signature");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close function");
    return { 
      type: "FunctionDeclaration", 
      name, 
      params, 
      returnType, 
      ...(isAsync ? { async: true } : {}),
      ...(environment ? { environment } : {}),
      body, 
      loc: this.loc(start) 
    };
  }

  private routeDecl(): RouteDeclaration {
    const start = this.advance(); // route
    const method = this.consume("Ident", "Expected HTTP method").value;
    const path = this.consume("String", "Expected route path").value;
    const params = this.check("LParen") ? this.paramList() : [];
    const returnType = this.match("Colon") ? this.typeAnnotation() : null;
    this.consume("LBrace", "Expected '{' after route signature");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close route");
    return { type: "RouteDeclaration", method, path, params, returnType, body, loc: this.loc(start) };
  }

  private toolDecl(): ToolDeclaration {
    const start = this.advance(); // tool
    const name = this.consume("Ident", "Expected tool name").value;
    let description = "";
    if (this.match("String")) {
      description = this.previous().value;
    }
    const params: Parameter[] = [];
    if (this.check("LParen")) {
      this.consume("LParen", "Expected '('");
      this.skipNewlines();
      if (!description && this.match("String")) {
        description = this.previous().value;
        if (this.match("Comma")) {
          this.skipNewlines();
        }
      }
      if (!this.check("RParen")) {
        do {
          this.skipNewlines();
          const pStart = this.peek();
          const pName = this.consume("Ident", "Expected parameter name").value;
          const optional = this.match("Question");
          const typeAnnotation = this.match("Colon") ? this.typeAnnotation() : null;
          const defaultValue = this.match("Eq") ? this.expression() : null;
          params.push({
            name: pName,
            typeAnnotation,
            ...(optional ? { optional: true } : {}),
            ...(defaultValue ? { defaultValue } : {}),
            loc: this.loc(pStart),
          });
          this.skipNewlines();
        } while (this.match("Comma"));
      }
      this.consume("RParen", "Expected ')' after parameters");
    }
    this.consume("LBrace", "Expected '{' after tool signature");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close tool");
    return { type: "ToolDeclaration", name, description, params, body, loc: this.loc(start) };
  }

  private paramList(): Parameter[] {
    this.consume("LParen", "Expected '('");
    const params: Parameter[] = [];
    this.skipNewlines();
    if (!this.check("RParen")) {
      do {
        this.skipNewlines();
        const start = this.peek();
        const name = this.consume("Ident", "Expected parameter name").value;
        const optional = this.match("Question");
        const typeAnnotation = this.match("Colon") ? this.typeAnnotation() : null;
        const defaultValue = this.match("Eq") ? this.expression() : null;
        params.push({
          name,
          typeAnnotation,
          ...(optional ? { optional: true } : {}),
          ...(defaultValue ? { defaultValue } : {}),
          loc: this.loc(start),
        });
        this.skipNewlines();
      } while (this.match("Comma"));
    }
    this.consume("RParen", "Expected ')' after parameters");
    return params;
  }

  private singleTypeAnnotation(): TypeAnnotation {
    const start = this.peek();
    let type: TypeAnnotation;
    if (this.match("LParen")) {
      const inner = this.typeAnnotation();
      this.consume("RParen", "Expected ')' after type");
      type = inner;
    } else if (start.type === "Ident") {
      this.advance();
      const name = this.previous().value;
      if (PRIMITIVE_TYPES.has(name)) {
        type = { kind: name as TypeAnnotation["kind"], loc: this.loc(start) };
      } else {
        type = { kind: "reference", refName: name, loc: this.loc(start) };
      }
    } else if (start.type === "Null") {
      this.advance();
      type = { kind: "null", loc: this.loc(start) };
    } else if (this.match("LBrace")) {
      const properties: ObjectTypeProperty[] = [];
      this.skipNewlines();
      while (!this.check("RBrace") && !this.isAtEnd()) {
        const propStart = this.peek();
        const propName = this.consume("Ident", "Expected property name").value;
        const optional = this.match("Question");
        this.consume("Colon", "Expected ':' after property name");
        const propType = this.typeAnnotation();
        properties.push({
          name: propName,
          typeAnnotation: propType,
          ...(optional ? { optional: true } : {}),
          loc: this.loc(propStart),
        });
        this.skipNewlines();
        if (this.match("Comma") || this.match("Semicolon")) {
          this.skipNewlines();
        }
      }
      this.consume("RBrace", "Expected '}' after object type");
      type = { kind: "object", properties, loc: this.loc(start) };
    } else {
      return this.fail("Expected a type annotation", start);
    }

    while (this.match("LBracket")) {
      this.consume("RBracket", "Expected ']' after array type");
      type = { kind: "array", elementType: type, loc: this.loc(start) };
    }

    if (this.match("Question")) {
      type = {
        kind: "union",
        types: [type, { kind: "null", loc: this.loc(this.previous()) }],
        loc: this.loc(start),
      };
    }

    return type;
  }

  private typeAnnotation(): TypeAnnotation {
    const first = this.singleTypeAnnotation();
    if (!this.match("Pipe")) return first;

    const types: TypeAnnotation[] = [first];
    do {
      types.push(this.singleTypeAnnotation());
    } while (this.match("Pipe"));

    return {
      kind: "union",
      types,
      loc: { start: first.loc.start, end: types[types.length - 1].loc.end },
    };
  }

  // -- blocks & statements ------------------------------------------------

  private blockItems(): BlockItem[] {
    const items: BlockItem[] = [];
    while (!this.check("RBrace") && !this.isAtEnd()) {
      try {
        this.skipNewlines();
        if (this.check("RBrace") || this.isAtEnd()) break;
        items.push(this.item() as BlockItem);
      } catch {
        this.synchronizeToStatementEnd();
      }
    }
    return items;
  }

  private synchronizeToStatementEnd(): void {
    while (!this.isAtEnd()) {
      const t = this.peek();
      if (t.type === "Newline") { this.advance(); return; }
      if (t.type === "RBrace") return;
      this.advance();
    }
  }

  /** Parse one statement, property, event handler, or element. */
  private item(): AnyItem {
    const t = this.peek();

    if (t.type === "Keyword") {
      switch (t.value) {
        case "state": return this.stateBlock();
        case "style": return this.styleBlock();
        case "ai": return this.aiBlock();
        case "let": return this.variableDecl();
        case "if": return this.ifStatement();
        case "for": return this.forStatement();
        case "return": return this.returnStatement();
        case "try": return this.tryStatement();
      }
    }

    // A slot must be recognized before the generic element branch.
    if (t.type === "Ident" && t.value === "slot" && ["LBrace", "LParen"].includes(this.peek(1).type)) {
      return this.slot();
    }

    // Element or event handler: Ident followed by '{' (or arguments/params).
    if (t.type === "Ident" && this.peek(1).type === "LBrace") {
      if (/^on[A-Z]/.test(t.value)) return this.eventBlock(t.value);
      return this.element();
    }
    if (t.type === "Ident" && this.peek(1).type === "LParen") {
      if (/^on[A-Z]/.test(t.value)) return this.eventBlock(t.value);
      let depth = 0;
      let i = 1;
      let hasBrace = false;
      while (this.peek(i).type !== "EOF" && this.peek(i).type !== "Newline") {
        if (this.peek(i).type === "LParen") depth++;
        else if (this.peek(i).type === "RParen") {
          depth--;
          if (depth === 0) {
            if (this.peek(i + 1).type === "LBrace") {
              hasBrace = true;
            }
            break;
          }
        }
        i++;
      }
      if (hasBrace) {
        return this.element();
      }
    }

    // key: value property inside an element.
    if (t.type === "Ident" && this.peek(1).type === "Colon") {
      return this.property();
    }

    const expr = this.expression();
    this.match("Semicolon");
    return { type: "ExpressionStatement", expression: expr, loc: expr.loc };
  }

  private tryStatement(): TryStatement {
    const start = this.advance(); // try
    this.consume("LBrace", "Expected '{' after 'try'");
    const block = this.blockItems();
    this.consume("RBrace", "Expected '}' to close try block");

    let handler: CatchClause | null = null;
    let finalizer: BlockStatement | null = null;

    if (this.peek().type === "Keyword" && this.peek().value === "catch") {
      const catchStart = this.advance(); // catch
      let param: Parameter | null = null;
      if (this.match("LParen")) {
        const paramStart = this.peek();
        const paramName = this.consume("Ident", "Expected catch parameter name").value;
        const typeAnnotation = this.match("Colon") ? this.typeAnnotation() : null;
        param = { name: paramName, typeAnnotation, loc: this.loc(paramStart) };
        this.consume("RParen", "Expected ')' after catch parameter");
      }
      this.consume("LBrace", "Expected '{' after 'catch'");
      const catchBody = this.blockItems();
      this.consume("RBrace", "Expected '}' to close catch block");
      handler = {
        type: "CatchClause",
        param,
        body: { type: "BlockStatement", body: catchBody, loc: catchBody[0]?.loc ?? this.loc(catchStart) },
        loc: this.loc(catchStart),
      };
    }

    if (this.peek().type === "Keyword" && this.peek().value === "finally") {
      const finallyStart = this.advance(); // finally
      this.consume("LBrace", "Expected '{' after 'finally'");
      const finallyBody = this.blockItems();
      this.consume("RBrace", "Expected '}' to close finally block");
      finalizer = {
        type: "BlockStatement",
        body: finallyBody,
        loc: finallyBody[0]?.loc ?? this.loc(finallyStart),
      };
    }

    return {
      type: "TryStatement",
      block: { type: "BlockStatement", body: block, loc: block[0]?.loc ?? this.loc(start) },
      handler,
      finalizer,
      loc: this.loc(start),
    };
  }

  private stateBlock(): StateBlock {
    const start = this.advance(); // state
    this.consume("LBrace", "Expected '{' after 'state'");
    const variables: StateVariable[] = [];
    while (!this.check("RBrace") && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check("RBrace")) break;
      variables.push(this.stateVariable());
    }
    this.consume("RBrace", "Expected '}' to close state block");
    return { type: "StateBlock", variables, loc: this.loc(start) };
  }

  private aiBlock(): AiBlock {
    const start = this.advance(); // ai
    // optional attributes like provider/model could go here, but for now just parse body
    this.consume("LBrace", "Expected '{' after 'ai'");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close ai block");
    return { type: "AiBlock", body, loc: this.loc(start) };
  }

  private stateVariable(): StateVariable {
    const start = this.peek();
    const id = this.consume("Ident", "Expected state variable name").value;
    const typeAnnotation = this.match("Colon") ? this.typeAnnotation() : null;
    this.consume("Eq", "Expected '=' in state variable initializer");
    const init = this.expression();
    return { id, typeAnnotation, init, loc: this.loc(start) };
  }

  private styleBlock(): StyleBlock {
    const start = this.advance(); // style
    this.consume("LBrace", "Expected '{' after 'style'");
    const properties: StyleProperty[] = [];
    while (!this.check("RBrace") && !this.isAtEnd()) {
      this.skipNewlines();
      if (this.check("RBrace")) break;
      const propStart = this.peek();
      const key = this.consume("Ident", "Expected style property name").value;
      this.consume("Colon", "Expected ':' after style property name");
      properties.push({ key, value: this.literal(), loc: this.loc(propStart) });
    }
    this.consume("RBrace", "Expected '}' to close style block");
    return { type: "StyleBlock", properties, target: "element", loc: this.loc(start) };
  }

  private element(): Element {
    const nameTok = this.advance(); // element name
    const args: Expression[] = [];
    if (this.match("LParen")) {
      if (!this.check("RParen")) {
        do {
          args.push(this.expression());
        } while (this.match("Comma"));
      }
      this.consume("RParen", "Expected ')' after component arguments");
    }
    this.consume("LBrace", "Expected '{' after element name");
    const items: ElementItem[] = [];
    while (!this.check("RBrace") && !this.isAtEnd()) {
      try {
        this.skipNewlines();
        if (this.check("RBrace")) break;
        items.push(this.item());
      } catch {
        this.synchronizeToStatementEnd();
      }
    }
    this.consume("RBrace", `Expected '}' to close <${nameTok.value}>`);
    return { type: "Element", name: nameTok.value, arguments: args, items, loc: this.loc(nameTok) };
  }

  private slot(): Slot {
    const start = this.advance(); // 'slot'
    let name: string | undefined;
    if (this.match("LParen")) {
      if (!this.check("RParen")) {
        name = this.match("String")
          ? this.previous().value
          : this.consume("Ident", "Expected slot name").value;
      }
      this.consume("RParen", "Expected ')' after slot name");
    }
    this.consume("LBrace", "Expected '{' after 'slot'");
    this.skipNewlines();
    // Backward-compatible declaration: slot { name: "footer" }
    if (this.peek().type === "Ident" && this.peek().value === "name" && this.peek(1).type === "Colon") {
      this.advance(); // name
      this.consume("Colon", "Expected ':' after 'name'");
      if (this.peek().type === "String") {
        name = this.advance().value;
      } else {
        name = this.consume("Ident", "Expected slot name").value;
      }
      this.skipNewlines();
    }
    const items: ElementItem[] = [];
    while (!this.check("RBrace") && !this.isAtEnd()) {
      items.push(this.item());
      this.skipNewlines();
    }
    this.consume("RBrace", "Expected '}' to close <slot>");
    return { type: "Slot", name, items, loc: this.loc(start) };
  }

  private property(): Property {
    const start = this.peek();
    const key = this.consume("Ident", "Expected property name").value;
    this.consume("Colon", "Expected ':' after property name");
    const value = this.expression();
    this.match("Semicolon");
    return { type: "Property", key, value, isStyle: false, loc: this.loc(start) };
  }

  private eventBlock(name: string): EventBlock {
    const start = this.advance(); // handler name
    let params: Parameter[] = [];
    if (this.check("LParen")) params = this.paramList();
    this.consume("LBrace", "Expected '{' after event handler name");
    const bodyStart = this.peek();
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close event handler");
    return {
      type: "EventBlock",
      name,
      params,
      body: { type: "BlockStatement", body, loc: body[0]?.loc ?? this.loc(bodyStart) },
      loc: this.loc(start),
    };
  }

  private variableDecl(): VariableDeclaration {
    const start = this.advance(); // let
    const declarations: VariableDeclarator[] = [];
    do {
      const declStart = this.peek();
      const id = this.consume("Ident", "Expected variable name").value;
      const typeAnnotation = this.match("Colon") ? this.typeAnnotation() : null;
      const init = this.match("Eq") ? this.expression() : null;
      declarations.push({ id, typeAnnotation, init, loc: this.loc(declStart) });
    } while (this.match("Comma"));
    this.match("Semicolon");
    return { type: "VariableDeclaration", declarations, loc: this.loc(start) };
  }

  private ifStatement(): IfStatement {
    const start = this.advance(); // if
    const test = this.expression();
    this.consume("LBrace", "Expected '{' after if condition");
    const consequent = this.blockItems();
    this.consume("RBrace", "Expected '}' to close if body");

    let alternate: BlockStatement | null = null;
    if (this.peek().type === "Keyword" && this.peek().value === "else") {
      this.advance();
      if (this.peek().type === "Keyword" && this.peek().value === "if") {
        const nestedStart = this.peek();
        const nested = this.ifStatement();
        alternate = { type: "BlockStatement", body: [nested], loc: this.loc(nestedStart) };
      } else {
        this.consume("LBrace", "Expected '{' after 'else'");
        const elseBody = this.blockItems();
        this.consume("RBrace", "Expected '}' to close else body");
        alternate = { type: "BlockStatement", body: elseBody, loc: elseBody[0]?.loc ?? this.loc(start) };
      }
    }

    return {
      type: "IfStatement",
      test,
      consequent: { type: "BlockStatement", body: consequent, loc: consequent[0]?.loc ?? this.loc(start) },
      alternate,
      loc: this.loc(start),
    };
  }

  private forStatement(): ForStatement {
    const start = this.advance(); // for
    const variable = this.consume("Ident", "Expected loop variable name").value;
    this.consume("Keyword", "Expected 'in' after loop variable");
    const iterable = this.expression();
    this.consume("LBrace", "Expected '{' after for iterable");
    const body = this.blockItems();
    this.consume("RBrace", "Expected '}' to close for body");
    return {
      type: "ForStatement",
      variable,
      iterable,
      body: { type: "BlockStatement", body, loc: body[0]?.loc ?? this.loc(start) },
      loc: this.loc(start),
    };
  }

  private returnStatement(): ReturnStatement {
    const start = this.advance(); // return
    let argument: Expression | null = null;
    if (!this.check("Newline") && !this.check("RBrace") && !this.isAtEnd()) {
      argument = this.expression();
    }
    this.match("Semicolon");
    return { type: "ReturnStatement", argument, loc: this.loc(start) };
  }

  // -- expressions ---------------------------------------------------------

  private expression(): Expression {
    return this.assignment();
  }

  private assignment(): Expression {
    const left = this.logicalOr();
    if (this.match("Eq", "PlusEq", "MinusEq", "MultEq", "DivEq")) {
      const opToken = this.previous();
      const right = this.assignment();
      return {
        type: "AssignmentExpression",
        operator: opToken.value as AssignmentExpression["operator"],
        left: left as AssignmentExpression["left"],
        right,
        loc: { start: left.loc.start, end: right.loc.end },
      };
    }
    return left;
  }

  private logicalOr(): Expression {
    let expr = this.logicalAnd();
    while (this.match("OrOr")) {
      const op = this.previous().value as LogicalExpression["operator"];
      const right = this.logicalAnd();
      expr = { type: "LogicalExpression", operator: op, left: expr, right, loc: { start: expr.loc.start, end: right.loc.end } };
    }
    return expr;
  }

  private logicalAnd(): Expression {
    let expr = this.equality();
    while (this.match("AndAnd")) {
      const op = this.previous().value as LogicalExpression["operator"];
      const right = this.equality();
      expr = { type: "LogicalExpression", operator: op, left: expr, right, loc: { start: expr.loc.start, end: right.loc.end } };
    }
    return expr;
  }

  private equality(): Expression {
    let expr = this.comparison();
    while (this.match("EqEq", "EqEqEq", "NotEq")) {
      expr = this.binary(expr);
    }
    return expr;
  }

  private comparison(): Expression {
    let expr = this.term();
    while (this.match("Lt", "Gt", "LtEq", "GtEq")) {
      expr = this.binary(expr);
    }
    return expr;
  }

  private term(): Expression {
    let expr = this.factor();
    while (this.match("Plus", "Minus")) {
      expr = this.binary(expr);
    }
    return expr;
  }

  private factor(): Expression {
    let expr = this.unary();
    while (this.match("Star", "Slash", "Percent")) {
      expr = this.binary(expr);
    }
    return expr;
  }

  private binary(left: Expression): Expression {
    const opToken = this.previous();
    const operator = opToken.value as BinaryExpression["operator"];
    const right = this.unary();
    return { type: "BinaryExpression", operator, left, right, loc: { start: left.loc.start, end: right.loc.end } };
  }

  private unary(): Expression {
    if (this.peek().type === "Keyword" && this.peek().value === "await") {
      const opToken = this.advance();
      const argument = this.unary();
      return {
        type: "AwaitExpression",
        argument,
        loc: { start: opToken.start, end: argument.loc.end },
      };
    }
    if (this.match("PlusPlus", "MinusMinus")) {
      const opToken = this.previous();
      const argument = this.unary();
      return {
        type: "UpdateExpression",
        operator: opToken.value as UpdateExpression["operator"],
        argument,
        prefix: true,
        loc: { start: opToken.start, end: argument.loc.end },
      };
    }
    if (this.match("Bang", "Minus", "Plus")) {
      const opToken = this.previous();
      const argument = this.unary();
      return {
        type: "UnaryExpression",
        operator: opToken.value as UnaryExpression["operator"],
        argument,
        prefix: true,
        loc: { start: opToken.start, end: argument.loc.end },
      };
    }
    return this.postfix();
  }

  private postfix(): Expression {
    const expr = this.primary();
    if (this.match("PlusPlus", "MinusMinus")) {
      const opToken = this.previous();
      return {
        type: "UpdateExpression",
        operator: opToken.value as UpdateExpression["operator"],
        argument: expr,
        prefix: false,
        loc: { start: expr.loc.start, end: opToken.end },
      };
    }
    return expr;
  }

  private primary(): Expression {
    if (this.match("Number", "String", "Bool", "Null")) {
      const tok = this.previous();
      const literalType: Literal["literalType"] =
        tok.type === "Number" ? "number" : tok.type === "String" ? "string" : tok.type === "Bool" ? "boolean" : "null";
      const value =
        literalType === "number" ? Number(tok.value) : literalType === "boolean" ? tok.value === "true" : literalType === "null" ? null : tok.value;
      return { type: "Literal", literalType, value, raw: tok.value, loc: this.loc(tok) };
    }

    if (this.match("Ident")) {
      const tok = this.previous();
      const ident: Identifier = { type: "Identifier", name: tok.value, loc: this.loc(tok) };
      return this.memberOrCall(ident);
    }

    if (this.match("LParen")) {
      const expr = this.expression();
      this.skipNewlines();
      this.consume("RParen", "Expected ')' after expression");
      return expr;
    }

    if (this.match("LBracket")) {
      const start = this.previous();
      const elements: Array<Expression | SpreadElement> = [];
      this.skipNewlines();
      while (!this.check("RBracket") && !this.isAtEnd()) {
        if (this.match("DotDotDot")) {
          const spreadStart = this.previous();
          const argument = this.expression();
          elements.push({ type: "SpreadElement", argument, loc: { start: spreadStart.start, end: argument.loc.end } });
        } else {
          elements.push(this.expression());
        }
        this.skipNewlines();
        if (!this.match("Comma")) break;
        this.skipNewlines();
      }
      this.consume("RBracket", "Expected ']' after array literal");
      return { type: "ArrayLiteral", elements, loc: this.loc(start) };
    }

    if (this.match("LBrace")) {
      const start = this.previous();
      const properties: Array<KeyedProperty | SpreadElement> = [];
      this.skipNewlines();
      while (!this.check("RBrace") && !this.isAtEnd()) {
        if (this.match("DotDotDot")) {
          const spreadStart = this.previous();
          const argument = this.expression();
          properties.push({ type: "SpreadElement", argument, loc: { start: spreadStart.start, end: argument.loc.end } });
        } else {
          const propStart = this.peek();
          const key = this.consume("Ident", "Expected object property name").value;
          this.consume("Colon", "Expected ':' after object property name");
          properties.push({ key, value: this.expression(), loc: this.loc(propStart) });
        }
        this.skipNewlines();
        if (!this.match("Comma")) break;
        this.skipNewlines();
      }
      this.consume("RBrace", "Expected '}' after object literal");
      return { type: "ObjectLiteral", properties, loc: this.loc(start) };
    }

    const t = this.peek();
    return this.fail(`Unexpected token '${t.value || t.type}'`, t);
  }

  private memberOrCall(expr: Expression): Expression {
    while (true) {
      if (this.match("Dot")) {
        const propTok = this.consume("Ident", "Expected property name after '.'");
        const prop: Identifier = { type: "Identifier", name: propTok.value, loc: { start: propTok.start, end: propTok.end } };
        expr = { type: "MemberExpression", object: expr, property: prop, computed: false, loc: { start: expr.loc.start, end: propTok.end } };
      } else if (this.match("LBracket")) {
        const property = this.expression();
        const close = this.consume("RBracket", "Expected ']' after computed member");
        expr = { type: "MemberExpression", object: expr, property, computed: true, loc: { start: expr.loc.start, end: close.end } };
      } else if (this.match("LParen")) {
        const args: Expression[] = [];
        this.skipNewlines();
        if (!this.check("RParen")) {
          do {
            args.push(this.expression());
            this.skipNewlines();
          } while (this.match("Comma"));
        }
        const close = this.consume("RParen", "Expected ')' after arguments");
        expr = { type: "CallExpression", callee: expr, args, loc: { start: expr.loc.start, end: close.end } };
      } else {
        return expr;
      }
    }
  }

  private literal(): Literal {
    if (this.match("Number", "String", "Bool", "Null")) {
      const tok = this.previous();
      const literalType: Literal["literalType"] =
        tok.type === "Number" ? "number" : tok.type === "String" ? "string" : tok.type === "Bool" ? "boolean" : "null";
      const value =
        literalType === "number" ? Number(tok.value) : literalType === "boolean" ? tok.value === "true" : literalType === "null" ? null : tok.value;
      return { type: "Literal", literalType, value, raw: tok.value, loc: this.loc(tok) };
    }
    return this.fail("Expected a literal value", this.peek());
  }
}

/** Parse JGrandson source into a {@link Program}, collecting diagnostics. */
export function parse(source: string, sourceName = "<input>"): ParseResult {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch (e) {
    if (e instanceof SourceError) {
      const diagnostic: Diagnostic = {
        code: "LEX_ERROR",
        message: e.message,
        severity: "error",
        loc: e.span,
      };
      return {
        program: {
          type: "Program",
          body: [],
          sourceName,
          diagnostics: [diagnostic],
          loc: { start: { offset: 0, line: 1, column: 1 }, end: { offset: source.length, line: 1, column: 1 } },
        },
        diagnostics: [diagnostic],
      };
    }
    throw e;
  }
  return new Parser(tokens, sourceName, source.length).parse();
}
