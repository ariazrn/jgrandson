import { SourceLocation, TypeAnnotation, Expression } from "@jgrandson/ast";

export interface IRNode {
  type: string;
  loc?: SourceLocation;
}

export interface IRProgram extends IRNode {
  type: "IRProgram";
  modules: IRModule[];
}

export interface IRModule extends IRNode {
  type: "IRModule";
  name: string;
  components: IRComponent[];
  functions: IRFunction[];
}

export interface IRComponent extends IRNode {
  type: "IRComponent";
  name: string;
  isPage: boolean;
  props: IRProp[];
  state: IRState[];
  template: IRDomNode;
}

export interface IRFunction extends IRNode {
  type: "IRFunction";
  name: string;
  isServer: boolean;
  isBrowser: boolean;
  // Details omitted for MVP
}

export interface IRProp {
  name: string;
  typeAnnotation?: TypeAnnotation;
  defaultValue?: Expression;
}

export interface IRState {
  name: string;
  initialValue?: Expression;
}

export type IRDomNode = IRElement | IRText | IRSlot | IRControlFlow;

export interface IRElement extends IRNode {
  type: "IRElement";
  tag: string;
  attributes: Record<string, any>;
  events: Record<string, any>;
  children: IRDomNode[];
}

export interface IRText extends IRNode {
  type: "IRText";
  content: string | Expression;
}

export interface IRSlot extends IRNode {
  type: "IRSlot";
  name: string;
  fallback?: IRDomNode[];
}

export interface IRControlFlow extends IRNode {
  type: "IRIf" | "IRFor";
  // Omitted for brevity
}
