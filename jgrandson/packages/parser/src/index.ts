import { TokenType, type Token, LexerError } from '@jgrandson/lexer';
import type {
  Program,
  Page,
  ComponentDecl,
  FunctionDecl,
  Parameter,
  VariableDecl,
  ElementStmt,
  Property,
  StyleBlock,
  StateBlock,
  EventBlock,
  IfStmt,
  ForStmt,
  ReturnStmt,
  ImportStatement,
  ImportSpecifier,
  JGType,
  Statement,
  Expression,
  createLoc,
  LiteralExpr,
  IdentifierExpr,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  AssignExpr,
  UpdateExpr,
  TernaryExpr,
  ArrayLiteral,
  ObjectLiteral,
} from '@jgrandson/ast';

export class ParseError extends Error {
  public code: string;
  constructor(
    message: string,
    public line: number,
    public column: number,
    public sourceLine?: string
  ) {
    super(message);
    this.name = 'ParseError';
    this.code = 'JG001';
    if (sourceLine) {
      const lineNum = line.toString().padStart(2);
      this.message = `${message}\n\n${lineNum} | ${sourceLine}\n${' '.repeat(column + 2)}^`;
    }
  }
}

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  private source: string;

  constructor(source: string = '') {
    this.source = source;
  }

  parse(tokens: Token[], source: string): Program {
    this.tokens = tokens;
    this.source = source;
    this.pos = 0;

    return this.parseProgram();
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset: number = 1): Token {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) return this.tokens[this.tokens.length - 1];
    return this.tokens[idx];
  }

  private match(type: TokenType): boolean {
    if (this.current().type === type) {
      this.pos++;
      return true;
    }
    return false;
  }

  private expect(type: TokenType, context?: string): Token {
    const token = this.current();
    if (token.type === type) {
      this.pos++;
      return token;
    }
    const expected = this.tokenTypeName(type);
    throw this.error(
      token.line,
      token.column,
      `Expected ${expected}${context ? ` ${context}` : ''}, but found ${token.value || this.tokenTypeName(token.type)}`,
    );
  }

  private tokenTypeName(type: TokenType): string {
    return type.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  private loc(token: Token) {
    return createLoc(token.line, token.column, token.start, token.end);
  }

  private error(line: number, column: number, message: string): ParseError {
    let sourceLine: string | undefined;
    const lines = this.source.split('\n');
    if (line > 0 && line <= lines.length) {
      sourceLine = lines[line - 1];
    }
    return new ParseError(message, line, column, sourceLine);
  }

  private parseProgram(): Program {
    const body: Statement[] = [];
    const imports: ImportStatement[] = [];
    const pages: Page[] = [];
    const components: ComponentDecl[] = [];
    const functions: FunctionDecl[] = [];

    while (this.current().type !== TokenType.EOF) {
      while (this.match(TokenType.Newline)) {}

      if (this.current().type === TokenType.Identifier && this.current().value === 'import') {
        const imp = this.parseImport();
        imports.push(imp);
        body.push(imp);
        continue;
      }

      if (this.current().type === TokenType.Page) {
        const page = this.parsePage();
        pages.push(page);
        body.push(page);
        continue;
      }

      if (this.current().type === TokenType.Component) {
        const comp = this.parseComponent();
        components.push(comp);
        body.push(comp);
        continue;
      }

      if (this.current().type === TokenType.Function) {
        const fn = this.parseFunction();
        functions.push(fn);
        body.push(fn);
        continue;
      }

      if (this.current().type === TokenType.Identifier) {
        const stmt = this.parseIdentifierStatement();
        if (stmt) {
          body.push(stmt);
          continue;
        }
      }

      throw this.error(
        this.current().line,
        this.current().column,
        `Unexpected ${this.current().value || this.tokenTypeName(this.current().type)}`
      );
    }

    return {
      type: 'Program',
      body,
      imports,
      pages,
      components,
      functions,
      loc: createLoc(1, 1, 0, this.source.length),
    };
  }

  private parseImport(): ImportStatement {
    const start = this.current();
    this.expect(TokenType.Identifier); // import

    if (this.match(TokenType.Identifier)) {
      const specifiers: ImportSpecifier[] = [];
      while (true) {
        const local = this.expect(TokenType.Identifier).value;
        const imported = local;
        specifiers.push({
          type: 'ImportSpecifier',
          local,
          imported,
          loc: this.loc(start),
        });
        if (this.match(TokenType.Comma)) continue;
        break;
      }
      this.expect(TokenType.Identifier); // from
      const sourceToken = this.expect(TokenType.StringLiteral);
      this.expect(TokenType.Newline, 'or EOF at end of import');

      return {
        type: 'ImportStatement',
        specifiers,
        source: sourceToken.value,
        loc: createLoc(start.line, start.column, start.start, this.tokens[this.pos - 1].end),
      };
    }

    this.expect(TokenType.Mult, 'Expected * or identifier after import');
    this.expect(TokenType.Identifier); // as
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.Identifier); // from
    const sourceToken = this.expect(TokenType.StringLiteral);
    this.expect(TokenType.Newline, 'or EOF at end of import');

    return {
      type: 'ImportStatement',
      specifiers: [{
        type: 'ImportSpecifier',
        local: name,
        imported: '*',
        loc: this.loc(start),
      }],
      source: sourceToken.value,
      loc: createLoc(start.line, start.column, start.start, this.tokens[this.pos - 1].end),
    };
  }

  private parseIdentifierStatement(): Statement | null {
    if (this.current().value === 'state') {
      return this.parseStateBlock();
    }
    if (this.current().value === 'style') {
      return this.parseStyleBlock();
    }
    if (this.current().value === 'if') {
      return this.parseIf();
    }
    if (this.current().value === 'for') {
      return this.parseFor();
    }
    if (this.current().value === 'return') {
      return this.parseReturn();
    }

    return null;
  }

  private parseStateBlock(): StateBlock {
    const start = this.current();
    this.expect(TokenType.Identifier); // state
    this.expect(TokenType.LeftBrace);

    const variables: VariableDecl[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      variables.push(this.parseStateVariable());
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'StateBlock',
      variables,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseStateVariable(): VariableDecl {
    const start = this.current();
    const name = this.expect(TokenType.Identifier).value;

    let typeAnnotation: JGType | null = null;
    if (this.match(TokenType.Colon)) {
      const typeToken = this.expect(TokenType.Identifier);
      typeAnnotation = typeToken.value as JGType;
    }

    let initializer: Expression | null = null;
    if (this.match(TokenType.Assign)) {
      initializer = this.parseExpression();
    }

    this.expect(TokenType.Newline);

    return {
      type: 'VariableDecl',
      name,
      typeAnnotation,
      initializer,
      scope: 'state',
      loc: createLoc(start.line, start.column, start.start, this.current().end),
    };
  }

  private parseStyleBlock(): StyleBlock {
    const start = this.current();
    this.expect(TokenType.Identifier); // style
    this.expect(TokenType.LeftBrace);

    const properties: Property[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      properties.push(this.parseStyleProperty());
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'StyleBlock',
      properties,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseStyleProperty(): Property {
    const start = this.current();
    const key = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.Colon);
    const value = this.parseExpression();
    this.expect(TokenType.Newline);

    return {
      type: 'Property',
      key,
      value,
      loc: createLoc(start.line, start.column, start.start, this.current().end),
    };
  }

  private parsePage(): Page {
    const start = this.current();
    this.expect(TokenType.Page);
    const name = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.LeftBrace);

    const body: Statement[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      body.push(this.parseInnerStatement());
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'Page',
      name,
      body,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseComponent(): ComponentDecl {
    const start = this.current();
    this.expect(TokenType.Component);
    const name = this.expect(TokenType.Identifier).value;

    const params: Parameter[] = [];
    this.expect(TokenType.LeftParen);
    while (this.current().type !== TokenType.RightParen && this.current().type !== TokenType.EOF) {
      params.push(this.parseParameter());
      if (this.match(TokenType.Comma)) continue;
      break;
    }
    this.expect(TokenType.RightParen);

    this.expect(TokenType.LeftBrace);

    const body: Statement[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      body.push(this.parseInnerStatement());
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'ComponentDecl',
      name,
      params,
      body,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseFunction(): FunctionDecl {
    const start = this.current();
    this.expect(TokenType.Function);
    const name = this.expect(TokenType.Identifier).value;

    const params: Parameter[] = [];
    this.expect(TokenType.LeftParen);
    while (this.current().type !== TokenType.RightParen && this.current().type !== TokenType.EOF) {
      params.push(this.parseParameter());
      if (this.match(TokenType.Comma)) continue;
      break;
    }
    this.expect(TokenType.RightParen);

    let returnType: JGType = 'void';
    if (this.match(TokenType.Arrow)) {
      returnType = this.expect(TokenType.Identifier).value as JGType;
    }

    this.expect(TokenType.LeftBrace);

    const body: Statement[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      body.push(this.parseInnerStatement());
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'FunctionDecl',
      name,
      params,
      returnType,
      body,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseParameter(): Parameter {
    const start = this.current();
    const name = this.expect(TokenType.Identifier).value;
    let typeAnnotation: JGType = 'any';
    if (this.match(TokenType.Colon)) {
      typeAnnotation = this.expect(TokenType.Identifier).value as JGType;
    }

    return {
      type: 'Parameter',
      name,
      typeAnnotation,
      loc: createLoc(start.line, start.column, start.start, this.current().end),
    };
  }

  private parseInnerStatement(): Statement {
    const token = this.current();

    if (token.type === TokenType.Page) {
      return this.parsePage();
    }

    if (token.type === TokenType.Component) {
      return this.parseComponent();
    }

    if (token.type === TokenType.Function) {
      return this.parseFunction();
    }

    if (token.type === TokenType.Identifier && ['state', 'style'].includes(token.value)) {
      if (token.value === 'state') return this.parseStateBlock();
      if (token.value === 'style') return this.parseStyleBlock();
    }

    if (token.type === TokenType.Identifier && ['if', 'for', 'return'].includes(token.value)) {
      if (token.value === 'if') return this.parseIf();
      if (token.value === 'for') return this.parseFor();
      if (token.value === 'return') return this.parseReturn();
    }

    if (token.type === TokenType.Identifier) {
      return this.parseElement(token);
    }

    if (token.type === TokenType.Identifier && token.value === 'event') {
      return this.parseEvent();
    }

    if (token.type === TokenType.StringLiteral) {
      return this.parseTextContent(token);
    }

    if (token.type === TokenType.NumberLiteral || token.type === TokenType.BooleanLiteral) {
      return this.parseTextContent(token);
    }

    throw this.error(
      token.line,
      token.column,
      `Unexpected ${token.value || this.tokenTypeName(token.type)} in statement context`
    );
  }

  private parseElement(startToken: Token): ElementStmt {
    const name = startToken.value;
    this.pos++; // consume element name
    this.expect(TokenType.LeftBrace);

    const properties: Property[] = [];
    const children: Statement[] = [];

    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      if (this.current().type === TokenType.Identifier) {
        const token = this.current();

        if (token.value === 'event') {
          children.push(this.parseEvent());
          continue;
        }

        if (token.value === 'state') {
          children.push(this.parseStateBlock());
          continue;
        }

        if (token.value === 'style') {
          children.push(this.parseStyleBlock());
          continue;
        }

        if (token.value === 'if') {
          children.push(this.parseIf());
          continue;
        }

        if (token.value === 'for') {
          children.push(this.parseFor());
          continue;
        }

        if (token.value === 'function') {
          children.push(this.parseFunction());
          continue;
        }

        if (token.value === 'component') {
          children.push(this.parseComponent());
          continue;
        }

        if (token.value === 'page') {
          children.push(this.parsePage());
          continue;
        }

        if (this.peek().type === TokenType.Colon) {
          children.push(this.parseProperty(token));
          continue;
        }

        children.push(this.parseElement(token));
      } else {
        const token = this.current();
        let expr: Expression;
        if (token.type === TokenType.StringLiteral) {
          expr = this.parseLiteral(token);
        } else if (token.type === TokenType.NumberLiteral) {
          expr = this.parseLiteral(token);
        } else if (token.type === TokenType.BooleanLiteral) {
          expr = this.parseLiteral(token);
        } else {
          expr = this.parseExpression();
        }

        this.expect(TokenType.Newline);
        children.push({
          type: 'ElementStmt',
          name: 'text',
          properties: [{ type: 'Property', key: 'content', value: expr, loc: this.loc(token) }],
          children: [],
          loc: this.loc(startToken),
        });
      }
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'ElementStmt',
      name,
      properties,
      children,
      loc: createLoc(startToken.line, startToken.column, startToken.start, this.current().end - 1),
    };
  }

  private parseProperty(keyToken: Token): Property {
    const key = keyToken.value;
    this.pos++; // consume key
    this.expect(TokenType.Colon);
    const value = this.parseExpression();
    this.expect(TokenType.Newline);

    return {
      type: 'Property',
      key,
      value,
      loc: this.loc(keyToken),
    };
  }

  private parseEvent(): EventBlock {
    const start = this.current();
    this.expect(TokenType.Identifier); // event
    const eventName = this.expect(TokenType.Identifier).value;

    const params: Parameter[] = [];
    if (this.match(TokenType.LeftParen)) {
      while (this.current().type !== TokenType.RightParen && this.current().type !== TokenType.EOF) {
        params.push(this.parseParameter());
        if (this.match(TokenType.Comma)) continue;
        break;
      }
      this.expect(TokenType.RightParen);
    }

    this.expect(TokenType.LeftBrace);

    const body: Statement[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      body.push(this.parseInnerStatement());
    }

    this.expect(TokenType.RightBrace);
    this.expect(TokenType.Newline);

    return {
      type: 'EventBlock',
      eventName,
      params,
      body,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseTextContent(token: Token): ElementStmt {
    const expr = this.parseLiteral(token);
    this.expect(TokenType.Newline);

    return {
      type: 'ElementStmt',
      name: 'text',
      properties: [{ type: 'Property', key: 'content', value: expr, loc: this.loc(token) }],
      children: [],
      loc: this.loc(token),
    };
  }

  private parseIf(): IfStmt {
    const start = this.current();
    this.expect(TokenType.Identifier); // if
    const condition = this.parseExpression();
    this.expect(TokenType.LeftBrace);

    const thenBranch: Statement[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      thenBranch.push(this.parseInnerStatement());
    }

    this.expect(TokenType.RightBrace);

    let elseBranch: Statement[] | null = null;
    if (this.current().type === TokenType.Identifier && this.current().value === 'else') {
      this.pos++;
      this.expect(TokenType.LeftBrace);
      elseBranch = [];
      while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
        elseBranch.push(this.parseInnerStatement());
      }
      this.expect(TokenType.RightBrace);
    }

    return {
      type: 'IfStmt',
      condition,
      thenBranch,
      elseBranch,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseFor(): ForStmt {
    const start = this.current();
    this.expect(TokenType.Identifier); // for
    const itemName = this.expect(TokenType.Identifier).value;
    this.expect(TokenType.Identifier); // in

    const source = this.parseExpression();
    this.expect(TokenType.LeftBrace);

    const body: Statement[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      body.push(this.parseInnerStatement());
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'ForStmt',
      itemName,
      source,
      body,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  private parseReturn(): ReturnStmt {
    const start = this.current();
    this.expect(TokenType.Identifier); // return
    let value: Expression | null = null;

    if (this.current().type !== TokenType.Newline) {
      value = this.parseExpression();
    }

    this.expect(TokenType.Newline);

    return {
      type: 'ReturnStmt',
      value,
      loc: createLoc(start.line, start.column, start.start, this.current().end - 1),
    };
  }

  // Expression parsing with precedence

  private parseExpression(): Expression {
    return this.parseBinaryLogical();
  }

  private parseBinaryLogical(): Expression {
    let left = this.parseEquality();
    while (this.current().type === TokenType.AmpAmp || this.current().type === TokenType.PipePipe) {
      const op = this.current().value;
      const opToken = this.current();
      this.pos++;
      const right = this.parseEquality();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        loc: createLoc(opToken.line, opToken.column, opToken.start, right.loc.end),
      };
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();
    while (
      this.current().type === TokenType.DoubleEquals ||
      this.current().type === TokenType.NotEquals
    ) {
      const op = this.current().value;
      const opToken = this.current();
      this.pos++;
      const right = this.parseComparison();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        loc: createLoc(opToken.line, opToken.column, opToken.start, right.loc.end),
      };
    }
    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseAdditive();
    while (
      this.current().type === TokenType.LessThan ||
      this.current().type === TokenType.GreaterThan ||
      this.current().type === TokenType.LessThanOrEqual ||
      this.current().type === TokenType.GreaterThanOrEqual
    ) {
      const op = this.current().value;
      const opToken = this.current();
      this.pos++;
      const right = this.parseAdditive();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        loc: createLoc(opToken.line, opToken.column, opToken.start, right.loc.end),
      };
    }
    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    while (
      this.current().type === TokenType.Plus ||
      this.current().type === TokenType.Minus
    ) {
      const op = this.current().value;
      const opToken = this.current();
      this.pos++;
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        loc: createLoc(opToken.line, opToken.column, opToken.start, right.loc.end),
      };
    }
    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();
    while (this.current().type === TokenType.Star || this.current().type === TokenType.Slash) {
      const op = this.current().value;
      const opToken = this.current();
      this.pos++;
      const right = this.parseUnary();
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        loc: createLoc(opToken.line, opToken.column, opToken.start, right.loc.end),
      };
    }
    return left;
  }

  private parseUnary(): Expression {
    if (
      this.current().type === TokenType.Bang ||
      this.current().type === TokenType.Minus ||
      this.current().type === TokenType.Plus
    ) {
      const op = this.current().value;
      const opToken = this.current();
      this.pos++;
      const operand = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator: op,
        operand,
        prefix: true,
        loc: createLoc(opToken.line, opToken.column, opToken.start, operand.loc.end),
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.current().type === TokenType.Increment || this.current().type === TokenType.Decrement) {
        const op = this.current().value;
        const opToken = this.current();
        this.pos++;
        expr = {
          type: 'UpdateExpression',
          operator: op,
          argument: expr,
          prefix: false,
          loc: createLoc(opToken.line, opToken.column, opToken.start, this.current().end),
        };
      } else if (this.current().type === TokenType.LeftBracket) {
        const bracketToken = this.current();
        this.pos++;
        const property = this.parseExpression();
        this.expect(TokenType.RightBracket);
        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          computed: true,
          loc: createLoc(expr.loc.line, expr.loc.column, expr.loc.start, this.current().end),
        };
      } else if (this.current().type === TokenType.Dot) {
        const dotToken = this.current();
        this.pos++;
        const name = this.expect(TokenType.Identifier);
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: {
            type: 'Identifier',
            name: name.value,
            loc: this.loc(name),
          },
          computed: false,
          loc: createLoc(expr.loc.line, expr.loc.column, expr.loc.start, name.end),
        };
      } else if (this.current().type === TokenType.LeftParen) {
        const parenToken = this.current();
        this.pos++;
        const args: Expression[] = [];
        while (this.current().type !== TokenType.RightParen && this.current().type !== TokenType.EOF) {
          args.push(this.parseExpression());
          if (this.match(TokenType.Comma)) continue;
          break;
        }
        this.expect(TokenType.RightParen);
        expr = {
          type: 'CallExpression',
          callee: expr,
          args,
          loc: createLoc(expr.loc.line, expr.loc.column, expr.loc.start, this.current().end),
        };
      } else if (this.current().type === TokenType.Identifier && this.current().value === 'as') {
        const asToken = this.current();
        this.pos++;
        const typeName = this.expect(TokenType.Identifier);
        expr = {
          type: 'BinaryExpression',
          operator: 'as',
          left: expr,
          right: {
            type: 'Identifier',
            name: typeName.value,
            loc: this.loc(typeName),
          },
          loc: createLoc(asToken.line, asToken.column, asToken.start, typeName.end),
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): Expression {
    const token = this.current();

    if (token.type === TokenType.StringLiteral) {
      return this.parseLiteral(token);
    }

    if (token.type === TokenType.NumberLiteral) {
      return this.parseLiteral(token);
    }

    if (token.type === TokenType.BooleanLiteral) {
      const expr: LiteralExpr = {
        type: 'Literal',
        value: token.value === 'true',
        literalType: 'boolean',
        loc: this.loc(token),
      };
      this.pos++;
      return expr;
    }

    if (token.type === TokenType.Identifier) {
      if (token.value === 'true') {
        const expr: LiteralExpr = {
          type: 'Literal',
          value: true,
          literalType: 'boolean',
          loc: this.loc(token),
        };
        this.pos++;
        return expr;
      }
      if (token.value === 'false') {
        const expr: LiteralExpr = {
          type: 'Literal',
          value: false,
          literalType: 'boolean',
          loc: this.loc(token),
        };
        this.pos++;
        return expr;
      }
      if (token.value === 'null') {
        const expr: LiteralExpr = {
          type: 'Literal',
          value: null,
          literalType: 'null',
          loc: this.loc(token),
        };
        this.pos++;
        return expr;
      }

      this.pos++;
      return {
        type: 'Identifier',
        name: token.value,
        loc: this.loc(token),
      };
    }

    if (token.type === TokenType.LeftParen) {
      this.pos++;
      const expr = this.parseExpression();
      this.expect(TokenType.RightParen);
      return expr;
    }

    if (token.type === TokenType.LeftBrace) {
      return this.parseObjectLiteral();
    }

    if (token.type === TokenType.LeftBracket) {
      return this.parseArrayLiteral();
    }

    if (token.type === TokenType.Minus) {
      this.pos++;
      const num = this.parsePrimary();
      const opToken = token;
      return {
        type: 'UnaryExpression',
        operator: '-',
        operand: num,
        prefix: true,
        loc: createLoc(opToken.line, opToken.column, opToken.start, num.loc.end),
      };
    }

    throw this.error(
      token.line,
      token.column,
      `Unexpected ${token.value || this.tokenTypeName(token.type)} in expression context`
    );
  }

  private parseLiteral(token: Token): LiteralExpr {
    this.pos++;
    if (token.type === TokenType.StringLiteral) {
      return {
        type: 'Literal',
        value: token.value,
        literalType: 'string',
        loc: this.loc(token),
      };
    }
    if (token.type === TokenType.NumberLiteral) {
      return {
        type: 'Literal',
        value: parseFloat(token.value),
        literalType: 'number',
        loc: this.loc(token),
      };
    }
    return {
      type: 'Literal',
      value: token.value,
      literalType: 'string',
      loc: this.loc(token),
    };
  }

  private parseObjectLiteral(): ObjectLiteral {
    const start = this.current();
    this.expect(TokenType.LeftBrace);

    const properties: ObjectProperty[] = [];
    while (this.current().type !== TokenType.RightBrace && this.current().type !== TokenType.EOF) {
      const keyToken = this.expect(TokenType.Identifier);
      this.expect(TokenType.Colon);
      const value = this.parseExpression();
      properties.push({
        type: 'ObjectProperty',
        key: keyToken.value,
        value,
        loc: this.loc(keyToken),
      });
      if (this.match(TokenType.Comma)) continue;
    }

    this.expect(TokenType.RightBrace);

    return {
      type: 'ObjectLiteral',
      properties,
      loc: createLoc(start.line, start.column, start.start, this.current().end),
    };
  }

  private parseArrayLiteral(): ArrayLiteral {
    const start = this.current();
    this.expect(TokenType.LeftBracket);

    const elements: Expression[] = [];
    while (this.current().type !== TokenType.RightBracket && this.current().type !== TokenType.EOF) {
      elements.push(this.parseExpression());
      if (this.match(TokenType.Comma)) continue;
    }

    this.expect(TokenType.RightBracket);

    return {
      type: 'ArrayLiteral',
      elements,
      loc: createLoc(start.line, start.column, start.start, this.current().end),
    };
  }
}

export { LexerError };
