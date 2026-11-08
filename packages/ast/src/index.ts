export interface Position {
  offset: number;
  line: number;
  column: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export type NodeType =
  | "Program"
  | "ImportDeclaration"
  | "ImportSpecifier"
  | "ExportDeclaration"
  | "Page"
  | "Component"
  | "FunctionDeclaration"
  | "RouteDeclaration"
  | "StateBlock"
  | "StyleBlock"
  | "AiBlock"
  | "ToolDeclaration"
  | "Element"
  | "TextElement"
  | "Property"
  | "EventBlock"
  | "IfStatement"
  | "ForStatement"
  | "TryStatement"
  | "CatchClause"
  | "BlockStatement"
  | "ReturnStatement"
  | "AssignmentExpression"
  | "UpdateExpression"
  | "BinaryExpression"
  | "LogicalExpression"
  | "UnaryExpression"
  | "AwaitExpression"
  | "MemberExpression"
  | "CallExpression"
  | "Identifier"
  | "Literal"
  | "Parameter"
  | "VariableDeclaration"
  | "EmptyStatement"
  | "ArrayLiteral"
  | "ObjectLiteral"
  | "SpreadElement"
  | "KeyedProperty"
  | "StateVariable"
  | "ExpressionStatement"
  | "TypeAnnotation"
  | "TypeAliasDeclaration"
  | "InterfaceDeclaration"
  | "Slot";

export interface BaseNode {
  type: NodeType;
  loc: SourceLocation;
}

export interface Program extends BaseNode {
  type: "Program";
  body: TopLevelStatement[];
  sourceName: string;
  diagnostics?: Diagnostic[];
}

export interface Diagnostic {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  loc: SourceLocation;
}

export type TopLevelStatement =
  | ImportDeclaration
  | ExportDeclaration
  | Page
  | Component
  | FunctionDeclaration
  | RouteDeclaration
  | ToolDeclaration
  | TypeAliasDeclaration
  | InterfaceDeclaration;

export interface RouteDeclaration extends BaseNode {
  type: "RouteDeclaration";
  method: string;
  path: string;
  params: Parameter[];
  returnType: TypeAnnotation | null;
  body: BlockItem[];
}

export interface ImportSpecifier extends BaseNode {
  type: "ImportSpecifier";
  imported: string;
  local: string;
}

export interface ImportDeclaration extends BaseNode {
  type: "ImportDeclaration";
  name: string;
  defaultImport?: string | null;
  specifiers?: ImportSpecifier[];
  source: string;
}

export interface ExportDeclaration extends BaseNode {
  type: "ExportDeclaration";
  declaration: TopLevelStatement;
}

export interface Page extends BaseNode {
  type: "Page";
  name: string;
  body: BlockItem[];
}

export interface Component extends BaseNode {
  type: "Component";
  name: string;
  params: Parameter[];
  body: BlockItem[];
}

export interface FunctionDeclaration extends BaseNode {
  type: "FunctionDeclaration";
  name: string;
  params: Parameter[];
  returnType: TypeAnnotation | null;
  async?: boolean;
  environment?: "server" | "browser" | "shared";
  body: BlockItem[];
}

export interface Parameter {
  name: string;
  typeAnnotation: TypeAnnotation | null;
  optional?: boolean;
  defaultValue?: Expression | null;
  loc: SourceLocation;
}

export type BlockItem =
  | StateBlock
  | StyleBlock
  | AiBlock
  | IfStatement
  | ForStatement
  | TryStatement
  | Element
  | ExpressionStatement
  | VariableDeclaration
  | AssignmentExpression
  | UpdateExpression
  | ReturnStatement
  | EmptyStatement
  | Slot;

export interface AiBlock extends BaseNode {
  type: "AiBlock";
  provider?: string;
  model?: string;
  tools?: string[];
  body: BlockItem[];
}

export interface ToolDeclaration extends BaseNode {
  type: "ToolDeclaration";
  name: string;
  description: string;
  params: Parameter[];
  body: BlockItem[];
}

export interface TryStatement extends BaseNode {
  type: "TryStatement";
  block: BlockStatement;
  handler: CatchClause | null;
  finalizer?: BlockStatement | null;
}

export interface CatchClause extends BaseNode {
  type: "CatchClause";
  param: Parameter | null;
  body: BlockStatement;
}

export interface Element extends BaseNode {
  type: "Element";
  name: string;
  /** Positional arguments supplied to a component invocation. */
  arguments: Expression[];
  items: ElementItem[];
}

export type ElementItem =
  | Property
  | StyleBlock
  | EventBlock
  | BlockItem
  | Slot;

export interface TextElement extends BaseNode {
  type: "TextElement";
  content: Expression;
}

export interface Property extends BaseNode {
  type: "Property";
  key: string;
  value: Expression;
  isStyle: boolean;
}

export interface StyleBlock extends BaseNode {
  type: "StyleBlock";
  properties: StyleProperty[];
  target: "element" | "page" | "component";
}

export interface StateBlock extends BaseNode {
  type: "StateBlock";
  variables: StateVariable[];
}

export interface StyleProperty {
  key: string;
  value: Literal;
  loc: SourceLocation;
}

export interface EventBlock extends BaseNode {
  type: "EventBlock";
  name: string;
  params: Parameter[];
  body: BlockStatement;
}

export interface IfStatement extends BaseNode {
  type: "IfStatement";
  test: Expression;
  consequent: BlockStatement;
  alternate: BlockStatement | null;
}

export interface ForStatement extends BaseNode {
  type: "ForStatement";
  variable: string;
  iterable: Expression;
  body: BlockStatement;
}

export interface BlockStatement extends BaseNode {
  type: "BlockStatement";
  body: BlockItem[];
}

export interface ReturnStatement extends BaseNode {
  type: "ReturnStatement";
  argument: Expression | null;
}

export interface VariableDeclaration extends BaseNode {
  type: "VariableDeclaration";
  declarations: VariableDeclarator[];
}

export interface VariableDeclarator {
  id: string;
  typeAnnotation: TypeAnnotation | null;
  init: Expression | null;
  loc: SourceLocation;
}

export interface EmptyStatement extends BaseNode {
  type: "EmptyStatement";
}

export interface ExpressionStatement extends BaseNode {
  type: "ExpressionStatement";
  expression: Expression;
}

export type Expression =
  | Identifier
  | Literal
  | BinaryExpression
  | LogicalExpression
  | UnaryExpression
  | AwaitExpression
  | UpdateExpression
  | AssignmentExpression
  | MemberExpression
  | CallExpression
  | ArrayLiteral
  | ObjectLiteral;

export type LeftHandSideExpression = Identifier | MemberExpression;

export interface AssignmentExpression extends BaseNode {
  type: "AssignmentExpression";
  operator: "=" | "+=" | "-=" | "*=" | "/=";
  left: LeftHandSideExpression;
  right: Expression;
}

export interface Identifier extends BaseNode {
  type: "Identifier";
  name: string;
}

export interface Literal extends BaseNode {
  type: "Literal";
  literalType: "string" | "number" | "boolean" | "null";
  value: string | number | boolean | null;
  raw: string;
}

export interface BinaryExpression extends BaseNode {
  type: "BinaryExpression";
  operator: "+" | "-" | "*" | "/" | "%" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "===";
  left: Expression;
  right: Expression;
}

export interface LogicalExpression extends BaseNode {
  type: "LogicalExpression";
  operator: "&&" | "||";
  left: Expression;
  right: Expression;
}

export interface UnaryExpression extends BaseNode {
  type: "UnaryExpression";
  operator: "!" | "-" | "+";
  argument: Expression;
  prefix: boolean;
}

export interface AwaitExpression extends BaseNode {
  type: "AwaitExpression";
  argument: Expression;
}

export interface UpdateExpression extends BaseNode {
  type: "UpdateExpression";
  operator: "++" | "--";
  argument: Expression;
  prefix: boolean;
}

export interface MemberExpression extends BaseNode {
  type: "MemberExpression";
  object: Expression;
  property: Expression;
  computed: boolean;
}

export interface CallExpression extends BaseNode {
  type: "CallExpression";
  callee: Expression;
  args: Expression[];
}

export interface SpreadElement extends BaseNode {
  type: "SpreadElement";
  argument: Expression;
}

export interface ArrayLiteral extends BaseNode {
  type: "ArrayLiteral";
  elements: Array<Expression | SpreadElement>;
}

export interface ObjectLiteral extends BaseNode {
  type: "ObjectLiteral";
  properties: Array<KeyedProperty | SpreadElement>;
}

export interface KeyedProperty {
  key: string;
  value: Expression;
  loc: SourceLocation;
}

export interface StateVariable {
  id: string;
  typeAnnotation: TypeAnnotation | null;
  init: Expression | null;
  loc: SourceLocation;
}

export type TypeAnnotationKind =
  | "string"
  | "number"
  | "boolean"
  | "void"
  | "any"
  | "array"
  | "object"
  | "reference"
  | "null"
  | "union";

export interface ObjectTypeProperty {
  name: string;
  typeAnnotation: TypeAnnotation;
  optional?: boolean;
  loc: SourceLocation;
}

export type ProvenanceOrigin = "user" | "server" | "database" | "cache" | "external" | "ai";
export type TrustState = "untrusted" | "validated" | "authorized";
export type FreshnessState = "fresh" | "stale" | "unknown";

export interface ProvenanceMetadata {
  origin: ProvenanceOrigin;
  trust: TrustState;
  freshness: FreshnessState;
}

export interface TypeAnnotation {
  kind: TypeAnnotationKind;
  elementType?: TypeAnnotation;
  refName?: string;
  types?: TypeAnnotation[];
  properties?: ObjectTypeProperty[];
  nullable?: boolean;
  provenance?: ProvenanceMetadata;
  loc: SourceLocation;
}

export interface TypeAliasDeclaration extends BaseNode {
  type: "TypeAliasDeclaration";
  name: string;
  typeAnnotation: TypeAnnotation;
}

export interface InterfaceDeclaration extends BaseNode {
  type: "InterfaceDeclaration";
  name: string;
  properties: ObjectTypeProperty[];
}

export interface Slot extends BaseNode {
  type: "Slot";
  name?: string;
  /** Fallback content in a component, or supplied content at an invocation. */
  items: ElementItem[];
}

export type Statement = BlockItem;
