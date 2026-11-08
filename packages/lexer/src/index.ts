/**
 * @jgrandson/lexer — turns JGrandson source text into a stream of tokens.
 *
 * Newlines are significant (they separate properties/statements), so the
 * lexer emits `Newline` tokens and collapses runs of blank lines into one.
 * Comments and horizontal whitespace are skipped. Line/column are 1-based.
 */

import type { Position as SourcePos, SourceLocation as SourceSpan } from "@jgrandson/ast";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Base error carrying a source span, shared by lexer and parser. */
export class SourceError extends Error {
  readonly span: SourceSpan;

  constructor(message: string, span: SourceSpan) {
    super(message);
    this.name = "SourceError";
    this.span = span;
  }
}

/** Render a `SourceError` as a friendly multi-line diagnostic with a caret. */
export function formatSourceError(source: string, error: SourceError): string {
  const lines = source.split(/\r\n|\n|\r/);
  const { start } = error.span;
  const lineText = lines[start.line - 1] ?? "";
  const gutter = String(start.line).padStart(4);
  const caretPad = " ".repeat(Math.max(0, start.column - 1));
  return [
    `Syntax Error: ${error.message}`,
    "",
    `${gutter} | ${lineText}`,
    `${" ".repeat(gutter.length)} | ${caretPad}^`,
    ""
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type TokenType =
  | "Ident"
  | "Keyword"
  | "Number"
  | "String"
  | "Bool"
  | "Null"
  // punctuation
  | "LBrace"
  | "RBrace"
  | "LParen"
  | "RParen"
  | "LBracket"
  | "RBracket"
  | "Colon"
  | "Comma"
  | "Dot"
  | "DotDotDot"
  | "Semicolon"
  | "Question"
  | "Pipe"
  // operators
  | "Plus"
  | "Minus"
  | "Star"
  | "Slash"
  | "Eq"
  | "EqEq"
  | "EqEqEq"
  | "NotEq"
  | "Bang"
  | "Lt"
  | "Gt"
  | "LtEq"
  | "GtEq"
  | "PlusPlus"
  | "MinusMinus"
  | "PlusEq"
  | "MinusEq"
  | "MultEq"
  | "DivEq"
  | "Percent"
  | "AndAnd"
  | "OrOr"
  // layout
  | "Newline"
  | "EOF";

export interface Token {
  type: TokenType;
  /** Raw text: identifier/keyword name, string contents (unescaped), number text, or operator glyph. */
  value: string;
  start: SourcePos;
  end: SourcePos;
}

export const KEYWORDS = new Set([
  "page",
  "component",
  "function",
  "state",
  "style",
  "let",
  "if",
  "else",
  "for",
  "in",
  "return",
  "type",
  "interface",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "export",
  "server",
  "browser",
  "shared",
  "route",
  "ai",
  "tool"
]);

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

class Lexer {
  private i = 0;
  private line = 1;
  private column = 1;
  private lastTokenWasNewline = false;
  readonly tokens: Token[] = [];

  constructor(private readonly src: string) {}

  private pos(): SourcePos {
    return { offset: this.i, line: this.line, column: this.column };
  }

  private peek(offset = 0): string {
    return this.src[this.i + offset] ?? "";
  }

  private advance(): string {
    const ch = this.src[this.i++];
    if (ch === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private push(type: TokenType, value: string, start: SourcePos, end: SourcePos): void {
    this.tokens.push({ type, value, start, end });
  }

  private pushNewline(): void {
    if (!this.lastTokenWasNewline && this.tokens.length > 0) {
      const at = this.pos();
      this.push("Newline", "\n", at, at);
    }
    this.lastTokenWasNewline = true;
  }

  tokenize(): Token[] {
    while (this.i < this.src.length) {
      const ch = this.peek();

      // Horizontal whitespace / CR before LF — skip.
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }

      // Line breaks.
      if (ch === "\n") {
        this.advance();
        this.pushNewline();
        continue;
      }

      // Comments.
      if (ch === "/" && this.peek(1) === "/") {
        while (this.i < this.src.length && this.peek() !== "\n") this.advance();
        continue;
      }
      if (ch === "/" && this.peek(1) === "*") {
        const start = this.pos();
        this.advance();
        this.advance();
        let closed = false;
        while (this.i < this.src.length) {
          if (this.peek() === "*" && this.peek(1) === "/") {
            this.advance();
            this.advance();
            closed = true;
            break;
          }
          if (this.peek() === "\n") {
            this.advance();
            this.pushNewline();
          } else {
            this.advance();
          }
        }
        if (!closed) throw new SourceError("Unterminated block comment", { start, end: this.pos() });
        continue;
      }

      // Strings.
      if (ch === '"') {
        this.lexString();
        continue;
      }

      // Numbers.
      if (DIGIT.test(ch)) {
        this.lexNumber();
        continue;
      }

      // Identifiers / keywords.
      if (IDENT_START.test(ch)) {
        this.lexIdent();
        continue;
      }

      this.lexPunctuator();
    }

    const at = this.pos();
    this.push("EOF", "", at, at);
    return this.tokens;
  }

  private lexString(): void {
    const start = this.pos();
    this.advance(); // opening quote
    let value = "";
    while (true) {
      const ch = this.peek();
      if (ch === "" || ch === "\n") {
        throw new SourceError("Unterminated string literal", { start, end: this.pos() });
      }
      if (ch === '"') {
        const end = { line: this.line, column: this.column + 1, offset: this.i };
        this.advance();
        this.push("String", value, start, end);
        this.lastTokenWasNewline = false;
        return;
      }
      if (ch === "\\") {
        this.advance();
        const esc = this.peek();
        switch (esc) {
          case "n": value += "\n"; break;
          case "t": value += "\t"; break;
          case "r": value += "\r"; break;
          case '"': value += '"'; break;
          case "\\": value += "\\"; break;
          case "": throw new SourceError("Unterminated string literal", { start, end: this.pos() });
          default: value += esc; break; // lenient: unknown escapes pass through
        }
        this.advance();
        continue;
      }
      value += ch;
      this.advance();
    }
  }

  private lexNumber(): void {
    const start = this.pos();
    let text = "";
    while (DIGIT.test(this.peek())) text += this.advance();
    if (this.peek() === "." && DIGIT.test(this.peek(1))) {
      text += this.advance(); // .
      while (DIGIT.test(this.peek())) text += this.advance();
    }
    this.push("Number", text, start, this.pos());
    this.lastTokenWasNewline = false;
  }

  private lexIdent(): void {
    const start = this.pos();
    let name = "";
    while (IDENT_PART.test(this.peek())) name += this.advance();
    const type: TokenType = KEYWORDS.has(name)
      ? "Keyword"
      : name === "true" || name === "false"
      ? "Bool"
      : name === "null"
      ? "Null"
      : "Ident";
    this.push(type, name, start, this.pos());
    this.lastTokenWasNewline = false;
  }

  private lexPunctuator(): void {
    const start = this.pos();
    const three = this.peek() + this.peek(1) + this.peek(2);
    if (three === "===") {
      this.advance();
      this.advance();
      this.advance();
      this.push("EqEqEq", three, start, this.pos());
      this.lastTokenWasNewline = false;
      return;
    }
    if (three === "...") {
      this.advance();
      this.advance();
      this.advance();
      this.push("DotDotDot", three, start, this.pos());
      this.lastTokenWasNewline = false;
      return;
    }
    const two = this.peek() + this.peek(1);
    const twoChar: Record<string, TokenType> = {
      "==": "EqEq",
      "!=": "NotEq",
      "<=": "LtEq",
      ">=": "GtEq",
      "++": "PlusPlus",
      "--": "MinusMinus",
      "+=": "PlusEq",
      "-=": "MinusEq",
      "&&": "AndAnd",
      "||": "OrOr"
    };
    if (twoChar[two]) {
      this.advance();
      this.advance();
      this.push(twoChar[two], two, start, this.pos());
      this.lastTokenWasNewline = false;
      return;
    }

    const oneChar: Record<string, TokenType> = {
      "{": "LBrace",
      "}": "RBrace",
      "(": "LParen",
      ")": "RParen",
      "[": "LBracket",
      "]": "RBracket",
      ":": "Colon",
      ",": "Comma",
      ".": "Dot",
      ";": "Semicolon",
      "?": "Question",
      "|": "Pipe",
      "+": "Plus",
      "-": "Minus",
      "*": "Star",
      "/": "Slash",
      "%": "Percent",
      "=": "Eq",
      "!": "Bang",
      "<": "Lt",
      ">": "Gt"
    };
    const type = oneChar[this.peek()];
    if (!type) {
      throw new SourceError(`Unexpected character '${this.peek()}'`, { start, end: { ...start, column: start.column + 1 } });
    }
    this.advance();
    this.push(type, this.src[this.i - 1], start, this.pos());
    this.lastTokenWasNewline = false;
  }
}

/** Tokenize JGrandson source. Throws {@link SourceError} on invalid input. */
export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
