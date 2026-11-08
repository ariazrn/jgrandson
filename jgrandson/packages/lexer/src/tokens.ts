export enum TokenType {
  // Identifiers
  Identifier = 'Identifier',
  
  // Keywords
  Page = 'Page',
  Component = 'Component',
  Function = 'Function',
  Return = 'Return',
  State = 'State',
  Style = 'Style',
  If = 'If',
  Else = 'Else',
  For = 'For',
  In = 'In',
  Let = 'Let',
  Import = 'Import',
  From = 'From',
  As = 'As',
  True = 'True',
  False = 'False',
  
  // Literals
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  
  // Event names (onClick, onInput, etc.)
  EventName = 'EventName',
  
  // Element names (button, div, input, etc.)
  ElementName = 'ElementName',
  
  // Operators
  Plus = 'Plus',         // +
  Minus = 'Minus',       // -
  Star = 'Star',         // *
  Slash = 'Slash',       // /
  Percent = 'Percent',   // %
  StarStar = 'StarStar', // **
  Equal = 'Equal',       // =
  EqualEqual = 'EqualEqual', // ==
  Bang = 'Bang',         // !
  BangEqual = 'BangEqual', // !=
  Greater = 'Greater',   // >
  Less = 'Less',         // <
  GreaterEqual = 'GreaterEqual', // >=
  LessEqual = 'LessEqual', // <=
  AmpAmp = 'AmpAmp',     // &&
  PipePipe = 'PipePipe', // ||
  PlusPlus = 'PlusPlus', // ++
  MinusMinus = 'MinusMinus', // --
  
  // Punctuation
  LeftBrace = 'LeftBrace',   // {
  RightBrace = 'RightBrace', // }
  LeftParen = 'LeftParen',   // (
  RightParen = 'RightParen', // )
  LeftBracket = 'LeftBracket', // [
  RightBracket = 'RightBracket', // ]
  Colon = 'Colon',           // :
  Semicolon = 'Semicolon',   // ;
  Comma = 'Comma',           // ,
  Dot = 'Dot',               // .
  
  // Special
  EOF = 'EOF',
  Newline = 'Newline',
  
  // Comments (skipped but token info kept)
  Comment = 'Comment',
}

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface Token {
  type: TokenType;
  value: string;
  start: SourcePosition;
  end: SourcePosition;
}

export interface TokenRange {
  start: SourcePosition;
  end: SourcePosition;
}
