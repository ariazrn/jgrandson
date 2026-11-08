import { TokenType, Token, SourcePosition } from './tokens';

const KEYWORDS: Record<string, TokenType> = {
  page: TokenType.Page,
  component: TokenType.Component,
  function: TokenType.Function,
  return: TokenType.Return,
  state: TokenType.State,
  style: TokenType.Style,
  if: TokenType.If,
  else: TokenType.Else,
  for: TokenType.For,
  in: TokenType.In,
  let: TokenType.Let,
  import: TokenType.Import,
  from: TokenType.From,
  as: TokenType.As,
  true: TokenType.True,
  false: TokenType.False,
};

const EVENT_NAMES: Record<string, TokenType> = {
  onClick: TokenType.EventName,
  onInput: TokenType.EventName,
  onChange: TokenType.EventName,
  onSubmit: TokenType.EventName,
  onFocus: TokenType.EventName,
  onBlur: TokenType.EventName,
};

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private startLine: number = 1;
  private startColumn: number = 1;
  private startOffset: number = 0;

  constructor(source: string) {
    this.source = source;
  }

  lex(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const start = this.currentPosition();

      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    tokens.push(this.makeToken(TokenType.EOF, '', this.currentPosition(), this.currentPosition()));
    return tokens;
  }

  private currentPosition(): SourcePosition {
    return { line: this.line, column: this.column, offset: this.pos };
  }

  private makeToken(
    type: TokenType,
    value: string,
    start: SourcePosition,
    end: SourcePosition
  ): Token {
    return { type, value, start, end };
  }

  private markStart(): void {
    this.startLine = this.line;
    this.startColumn = this.column;
    this.startOffset = this.pos;
  }

  private startingPosition(): SourcePosition {
    return { line: this.startLine, column: this.startColumn, offset: this.startOffset };
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '\n') {
        this.line++;
        this.column = 1;
        this.pos++;
      } else {
        break;
      }
    }
  }

  private nextToken(): Token | null {
    this.markStart();
    const ch = this.source[this.pos];

    if (this.isAlpha(ch) || ch === '_') {
      return this.readIdentifierOrKeyword();
    }
    if (this.isDigit(ch)) {
      return this.readNumber();
    }
    if (ch === '"' || ch === "'") {
      return this.readString();
    }
    if (ch === '/' && this.peek() === '/') {
      this.skipLineComment();
      return null;
    }
    if (ch === '/' && this.peek() === '*') {
      this.skipBlockComment();
      return null;
    }

    const start = this.startingPosition();
    const token = this.readOperatorOrPunctuation();
    if (token) {
      return token;
    }

    throw new Error(
      `Unexpected character '${ch}' at ${start.line}:${start.column}`
    );
  }

  private readIdentifierOrKeyword(): Token {
    let value = '';
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (this.isAlpha(ch) || this.isDigit(ch) || ch === '_' || ch === '.') {
        if (ch === '.' && !this.isAlpha(this.source[this.pos + 1])) {
          break;
        }
        value += ch;
        this.advance();
      } else {
        break;
      }
    }

    const start = this.startingPosition();
    const end = this.currentPosition();

    if (KEYWORDS[value]) {
      return this.makeToken(KEYWORDS[value], value, start, end);
    }

    if (EVENT_NAMES[value]) {
      return this.makeToken(EVENT_NAMES[value], value, start, end);
    }

    return this.makeToken(TokenType.Identifier, value, start, end);
  }

  private readNumber(): Token {
    let value = '';
    let isFloat = false;

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (this.isDigit(ch)) {
        value += ch;
        this.advance();
      } else if (ch === '.' && this.isDigit(this.source[this.pos + 1])) {
        isFloat = true;
        value += ch;
        this.advance();
      } else {
        break;
      }
    }

    const start = this.startingPosition();
    const end = this.currentPosition();
    return this.makeToken(TokenType.Number, value, start, end);
  }

  private readString(): Token {
    const quote = this.source[this.pos];
    this.advance();
    let value = '';
    const raw = [quote];

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === '\\') {
        const next = this.source[this.pos + 1];
        if (next === 'n') {
          value += '\n';
          raw.push('\\n');
        } else if (next === 't') {
          value += '\t';
          raw.push('\\t');
        } else if (next === 'r') {
          value += '\r';
          raw.push('\\r');
        } else if (next === '"') {
          value += '"';
          raw.push('\\"');
        } else if (next === "'") {
          value += "'";
          raw.push("\\'");
        } else if (next === '\\') {
          value += '\\';
          raw.push('\\\\');
        } else {
          value += next;
          raw.push('\\' + next);
        }
      this.pos += 2;
      this.column += 2;
      } else if (ch === quote) {
        this.advance();
        raw.push(quote);
        const start = this.startingPosition();
        const end = this.currentPosition();
        return this.makeToken(TokenType.String, value, start, end);
      } else if (ch === '\n') {
        throw new Error(
          `Unterminated string at line ${this.line}`
        );
      } else {
        value += ch;
        raw.push(ch);
        this.advance();
      }
    }

    throw new Error(`Unterminated string starting at line ${this.startLine}`);
  }

  private skipLineComment(): void {
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.pos++;
    }
  }

  private skipBlockComment(): void {
    this.pos += 2;
    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.source[this.pos + 1] === '/') {
        this.pos += 2;
        break;
      }
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      }
      this.pos++;
      this.column++;
    }
  }

  private readOperatorOrPunctuation(): Token | null {
    const ch = this.source[this.pos];
    const start = this.startingPosition();
    const two = this.source[this.pos] + (this.source[this.pos + 1] ?? '');
    const three = two + (this.source[this.pos + 2] ?? '');

    if (three === '...') {
      this.advance(); this.advance(); this.advance();
      return this.makeToken(TokenType.Dot, three, start, this.currentPosition());
    }

    const twoCharOps: Record<string, TokenType> = {
      '==': TokenType.EqualEqual,
      '!=': TokenType.BangEqual,
      '>=': TokenType.GreaterEqual,
      '<=': TokenType.LessEqual,
      '&&': TokenType.AmpAmp,
      '||': TokenType.PipePipe,
      '++': TokenType.PlusPlus,
      '--': TokenType.MinusMinus,
      '**': TokenType.StarStar,
    };

    if (twoCharOps[two]) {
      this.advance();
      this.advance();
      return this.makeToken(twoCharOps[two], two, start, this.currentPosition());
    }

    const singleCharMap: Record<string, TokenType> = {
      '+': TokenType.Plus,
      '-': TokenType.Minus,
      '*': TokenType.Star,
      '/': TokenType.Slash,
      '%': TokenType.Percent,
      '=': TokenType.Equal,
      '!': TokenType.Bang,
      '>': TokenType.Greater,
      '<': TokenType.Less,
      '{': TokenType.LeftBrace,
      '}': TokenType.RightBrace,
      '(': TokenType.LeftParen,
      ')': TokenType.RightParen,
      '[': TokenType.LeftBracket,
      ']': TokenType.RightBracket,
      ':': TokenType.Colon,
      ';': TokenType.Semicolon,
      ',': TokenType.Comma,
      '.': TokenType.Dot,
    };

    if (singleCharMap[ch]) {
      this.advance();
      return this.makeToken(singleCharMap[ch], ch, start, this.currentPosition());
    }

    return null;
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private peek(): string {
    return this.source[this.pos + 1] ?? '';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }
}

export function lex(source: string): Token[] {
  return new Lexer(source).lex();
}
