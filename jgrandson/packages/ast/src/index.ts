export type JGType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'void' | 'any';

export interface SourceLocation {
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface ASTNode {
  loc: SourceLocation;
}

export interface Program extends ASTNode {
  type: 'Program';
  body: Statement[];
  imports: ImportStatement[];
  pages: Page[];
  components: ComponentDecl[];
  functions: FunctionDecl[];
}

export interface ImportStatement extends ASTNode {
  type: 'ImportStatement';
  specifiers: ImportSpecifier[];
  source: string;
}

export interface ImportSpecifier extends ASTNode {
  type: 'ImportSpecifier';
  local: string;
  imported: string;
}

export interface Page extends ASTNode {
  type: 'Page';
  name: string;
  body: Statement[];
}

export interface ComponentDecl extends ASTNode {
  type: 'ComponentDecl';
  name: string;
  params: Parameter[];
  body: Statement[];
}

export interface FunctionDecl extends ASTNode {
  type: 'FunctionDecl';
  name: string;
  params: Parameter[];
  returnType: JGType;
  body: Statement[];
}

export interface Parameter extends ASTNode {
  type: 'Parameter';
  name: string;
  typeAnnotation: JGType;
}

export interface VariableDecl extends ASTNode {
  type: 'VariableDecl';
  name: string;
  typeAnnotation: JGType | null;
  initializer: Expression | null;
  scope: 'local' | 'state';
}

export interface ElementStmt extends ASTNode {
  type: 'ElementStmt';
  name: string;
  properties: Property[];
  children: Statement[];
}

export interface Property extends ASTNode {
  type: 'Property';
  key: string;
  value: Expression;
}

export interface StyleBlock extends ASTNode {
  type: 'StyleBlock';
  properties: Property[];
}

export interface StateBlock extends ASTNode {
  type: 'StateBlock';
  variables: VariableDecl[];
}

export interface EventBlock extends ASTNode {
  type: 'EventBlock';
  eventName: string;
  params: Parameter[];
  body: Statement[];
}

export interface IfStmt extends ASTNode {
  type: 'IfStmt';
  condition: Expression;
  thenBranch: Statement[];
  elseBranch: Statement[] | null;
}

export interface ForStmt extends ASTNode {
  type: 'ForStmt';
  itemName: string;
  source: Expression;
  body: Statement[];
}

export interface ReturnStmt extends ASTNode {
  type: 'ReturnStmt';
  value: Expression | null;
}

export type Statement =
  | Page
  | ComponentDecl
  | FunctionDecl
  | ElementStmt
  | VariableDecl
  | StateBlock
  | StyleBlock
  | EventBlock
  | IfStmt
  | ForStmt
  | ReturnStmt
  | ImportStatement;

export type Expression =
  | LiteralExpr
  | IdentifierExpr
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | AssignExpr
  | UpdateExpr
  | TernaryExpr
  | ArrayLiteral
  | ObjectLiteral;

export interface LiteralExpr extends ASTNode {
  type: 'Literal';
  value: string | number | boolean;
  literalType: 'string' | 'number' | 'boolean';
}

export interface IdentifierExpr extends ASTNode {
  type: 'Identifier';
  name: string;
}

export interface BinaryExpr extends ASTNode {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpr extends ASTNode {
  type: 'UnaryExpression';
  operator: string;
  operand: Expression;
  prefix: boolean;
}

export interface CallExpr extends ASTNode {
  type: 'CallExpression';
  callee: Expression;
  args: Expression[];
}

export interface MemberExpr extends ASTNode {
  type: 'MemberExpression';
  object: Expression;
  property: Expression;
  computed: boolean;
}

export interface AssignExpr extends ASTNode {
  type: 'AssignmentExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UpdateExpr extends ASTNode {
  type: 'UpdateExpression';
  operator: string;
  argument: Expression;
  prefix: boolean;
}

export interface TernaryExpr extends ASTNode {
  type: 'TernaryExpression';
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface ObjectLiteral extends ASTNode {
  type: 'ObjectLiteral';
  properties: ObjectProperty[];
}

export interface ObjectProperty extends ASTNode {
  type: 'ObjectProperty';
  key: string;
  value: Expression;
}

export function createLoc(line: number, column: number, start: number, end: number): SourceLocation {
  return { line, column, start, end };
}
