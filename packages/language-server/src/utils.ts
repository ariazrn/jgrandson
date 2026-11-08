import type { BaseNode, SourceLocation } from "@jgrandson/ast";

export function containsPosition(loc: SourceLocation, line: number, column: number): boolean {
  if (line < loc.start.line || line > loc.end.line) return false;
  if (line === loc.start.line && column < loc.start.column) return false;
  if (line === loc.end.line && column > loc.end.column) return false;
  return true;
}

export function findNodeAtPosition(node: any, line: number, column: number): BaseNode | null {
  if (!node || typeof node !== "object") return null;
  
  if (node.loc && !containsPosition(node.loc, line, column)) {
    return null;
  }

  let found: BaseNode | null = null;
  
  // Recursively search children
  for (const key in node) {
    if (key === "loc" || key === "type") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const childFound = findNodeAtPosition(item, line, column);
        if (childFound) found = childFound;
      }
    } else if (value && typeof value === "object") {
      const childFound = findNodeAtPosition(value, line, column);
      if (childFound) found = childFound;
    }
  }

  // If no more specific child was found, return this node (if it is a BaseNode)
  if (!found && node.type && node.loc) {
    return node as BaseNode;
  }
  
  return found;
}
