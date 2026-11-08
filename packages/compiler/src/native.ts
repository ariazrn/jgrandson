import { CompilerBackend, CompileResult } from "./backend";
import {
  Program,
  Element,
  TextElement,
  Property,
  StateBlock,
  StyleBlock,
  EventBlock,
  Expression,
  IfStatement,
  ForStatement,
} from "@jgrandson/ast";

function encodeVLQ(value: number): string {
  const VLQ_BASE_SHIFT = 5;
  const VLQ_BASE = 1 << VLQ_BASE_SHIFT;
  const VLQ_BASE_MASK = VLQ_BASE - 1;
  const VLQ_CONTINUATION_BIT = VLQ_BASE;
  const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let encoded = "";
  do {
    let digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) {
      digit |= VLQ_CONTINUATION_BIT;
    }
    encoded += BASE64_CHARS[digit];
  } while (vlq > 0);
  return encoded;
}

function generateSourceMap(filename: string, sourceName: string, linesCount: number, sourceLine = 1): string {
  const mappings: string[] = [];
  for (let i = 0; i < linesCount; i++) {
    const srcLine = Math.min(i + sourceLine - 1, sourceLine + linesCount);
    // col 0 -> source 0, line, col 0
    // [0, 0, srcLine - (previousSrcLine), 0]
    mappings.push(encodeVLQ(0) + encodeVLQ(0) + encodeVLQ(srcLine === 0 ? 0 : 0) + encodeVLQ(0));
  }
  const mapObj = {
    version: 3,
    file: filename,
    sources: [sourceName],
    sourcesContent: [`// JGrandson source for ${sourceName}`],
    names: [],
    mappings: mappings.join(";"),
  };
  return JSON.stringify(mapObj, null, 2);
}

export class NativeBackend implements CompilerBackend {
  private elementId = 0;

  generate(program: Program): CompileResult {
    const files = new Map<string, string>();
    const diagnostics: [] = [];

    const unwrappedBody = program.body.map(stmt =>
      stmt.type === "ExportDeclaration" ? stmt.declaration : stmt
    );

    for (const stmt of unwrappedBody) {
      if (stmt.type === "Page" || stmt.type === "Component") {
        this.elementId = 0;
        let html = "";
        const styles: string[] = [];
        const stateVars = new Set<string>();
        const islands: { id: string; name: string }[] = [];
        let script = "";
        let inits = "";
        let bindings = "";
        let hasEvents = false;

        // 1. Collect state
        for (const child of stmt.body) {
          if (child.type === "StateBlock") {
            const sb = child as StateBlock;
            for (const v of sb.variables) {
              stateVars.add(v.id);
              const initVal =
                v.init && v.init.type === "Literal" ? (v.init as any).value : null;
              inits += `state.${v.id} = ${JSON.stringify(initVal)};\n`;
            }
          } else if (child.type === "StyleBlock") {
            styles.push(this.formatStyleBlock(stmt.type === "Page" ? "body" : `.${stmt.name}`, child as StyleBlock));
          }
        }

        // 2. Render HTML & register DOM bindings and events
        for (const child of stmt.body) {
          if (child.type === "StateBlock" || child.type === "StyleBlock") {
            continue;
          }
          html += this.emitHtml(
            child,
            (event, id) => {
              hasEvents = true;
              let jsBody = "";
              if (event.params && event.params.length > 0) {
                const paramName = event.params[0].name;
                jsBody += `const ${paramName} = (e && e.target && e.target.value !== undefined) ? e.target.value : e;\n`;
              }
              for (const b of event.body.body) {
                jsBody += this.stmtToJS(b, stateVars);
              }
              const evtName = event.name.replace(/^on/, "").toLowerCase();
              script += `document.getElementById('${id}').addEventListener('${evtName}', (e) => {\n  ${jsBody}  updateDOM();\n});\n`;
            },
            (expr, id) => {
              const exprCode = this.exprToJS(expr, stateVars);
              bindings += `document.getElementById('${id}').textContent = ${exprCode};\n`;
            },
            (testExpr, id, isPositive) => {
              const cond = isPositive ? testExpr : `!(${testExpr})`;
              bindings += `if (document.getElementById('${id}')) document.getElementById('${id}').style.display = (${cond}) ? "" : "none";\n`;
            },
            (islandId, islandName) => {
              islands.push({ id: islandId, name: islandName });
            },
            stateVars,
            styles
          );
        }

        // 3. Islands Hydration Runtime
        let islandsRuntime = "";
        if (islands.length > 0) {
          hasEvents = true;
          islandsRuntime = `
// JGrandson Islands Hydration Runtime
(function hydrateIslands() {
  const registry = window.__JG_ISLANDS_REGISTRY__ || {};
  document.querySelectorAll('[data-island]').forEach((el) => {
    const name = el.getAttribute('data-island');
    const Component = registry[name] || (window[name] && window[name].default ? window[name].default : window[name]);
    if (Component) {
      if (window.ReactDOM && window.ReactDOM.createRoot) {
        const root = window.ReactDOM.createRoot(el);
        const props = {};
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-prop-')) {
            const propName = attr.name.slice(10);
            try { props[propName] = JSON.parse(attr.value); } catch { props[propName] = attr.value; }
          }
        }
        root.render(window.React ? window.React.createElement(Component, props) : null);
      } else {
        console.warn('[JGrandson Islands] ReactDOM.createRoot not found for island:', name);
      }
    }
  });
})();
`;
        }

        // 4. Source Map generation
        const sourceFileName = program.sourceName || `${stmt.name}.jg`;
        const mapFileName = `${stmt.name}.js.map`;

        // 5. Script block generation (Zero-JS optimization if purely static and no islands)
        let scriptBlock = "";
        const isInteractive = stateVars.size > 0 || hasEvents || bindings.length > 0 || islands.length > 0;
        if (isInteractive) {
          const rawScript = `const state = {};\n${inits}${script}\nfunction updateDOM() {\n${bindings}}\nupdateDOM();\n${islandsRuntime}`;
          const lines = rawScript.split("\n").length;
          const sourceMap = generateSourceMap(`${stmt.name}.js`, sourceFileName, lines, stmt.loc?.start?.line ?? 1);
          files.set(`${stmt.name}.js.map`, sourceMap);
          files.set(`${stmt.name}.js`, `${rawScript}\n//# sourceMappingURL=${mapFileName}\n`);

          scriptBlock = `\n<script>\n${rawScript}\n//# sourceMappingURL=${mapFileName}\n</script>\n`;
        }

        // 6. Style block generation
        const styleTag =
          styles.length > 0 ? `  <style>\n${styles.map(s => `    ${s.split("\n").join("\n    ")}`).join("\n\n")}\n  </style>\n` : "";

        if (stmt.type === "Page") {
          const fullHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${stmt.name}</title>\n${styleTag}</head>\n<body>\n${html}${scriptBlock}</body>\n</html>`;
          files.set(`${stmt.name}.html`, fullHtml);
        } else {
          files.set(`${stmt.name}.html`, `${styleTag}${html}${scriptBlock}`);
        }
      }
    }

    return { files, diagnostics };
  }

  private toKebabCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  }

  private toCssValue(key: string, val: any): string {
    if (typeof val === "number") {
      const unitless = new Set([
        "opacity",
        "zIndex",
        "lineHeight",
        "flex",
        "fontWeight",
        "order",
        "flexGrow",
        "flexShrink",
      ]);
      if (!unitless.has(key)) return `${val}px`;
      return `${val}`;
    }
    return String(val);
  }

  private formatStyleBlock(selector: string, block: StyleBlock): string {
    const rules = block.properties
      .map(p => {
        const key = this.toKebabCase(p.key);
        const rawVal = p.value.type === "Literal" ? (p.value as any).value : "";
        const val = this.toCssValue(p.key, rawVal);
        return `  ${key}: ${val};`;
      })
      .join("\n");
    return `${selector} {\n${rules}\n}`;
  }

  private exprToJS(expr: any, stateVars: Set<string>): string {
    if (!expr) return "null";
    if (expr.type === "Literal") {
      return JSON.stringify(expr.value);
    }
    if (expr.type === "Identifier") {
      return stateVars.has(expr.name) ? `state.${expr.name}` : expr.name;
    }
    if (expr.type === "BinaryExpression") {
      const left = this.exprToJS(expr.left, stateVars);
      const right = this.exprToJS(expr.right, stateVars);
      return `${left} ${expr.operator} ${right}`;
    }
    if (expr.type === "UnaryExpression") {
      return `${expr.operator}${this.exprToJS(expr.argument, stateVars)}`;
    }
    if (expr.type === "MemberExpression") {
      const obj = this.exprToJS(expr.object, stateVars);
      const prop = expr.property.name;
      return `${obj}.${prop}`;
    }
    if (expr.type === "CallExpression") {
      const callee = this.exprToJS(expr.callee, stateVars);
      const args = expr.arguments.map((a: any) => this.exprToJS(a, stateVars)).join(", ");
      return `${callee}(${args})`;
    }
    return "null";
  }

  private stmtToJS(stmt: any, stateVars: Set<string>): string {
    if (stmt.type === "ExpressionStatement") {
      const expr = stmt.expression;
      if (expr.type === "UpdateExpression" && expr.argument.type === "Identifier") {
        const delta = expr.operator === "++" ? "+ 1" : "- 1";
        return `state.${expr.argument.name} = state.${expr.argument.name} ${delta};\n`;
      }
      if (expr.type === "AssignmentExpression") {
        const target =
          expr.left.type === "Identifier" && stateVars.has(expr.left.name)
            ? `state.${expr.left.name}`
            : this.exprToJS(expr.left, stateVars);
        return `${target} ${expr.operator} ${this.exprToJS(expr.right, stateVars)};\n`;
      }
      return `${this.exprToJS(expr, stateVars)};\n`;
    }
    return "";
  }

  private emitHtml(
    node: any,
    onEvent: (event: EventBlock, id: string) => void,
    onBind: (expr: Expression, id: string) => void,
    onCond: (testExpr: string, id: string, isPositive: boolean) => void,
    onIsland: (islandId: string, islandName: string) => void,
    stateVars: Set<string>,
    styles: string[]
  ): string {
    if (node.type === "Element") {
      const el = node as Element;
      let attrs = "";
      let children = "";
      const id = `el_${this.elementId++}`;
      let hasEvents = false;

      for (const item of el.items) {
        if (item.type === "Property") {
          const prop = item as Property;
          if (el.name === "text" && prop.key === "content") {
            if (prop.value.type === "Literal") {
              children += (prop.value as any).value;
            } else {
              onBind(prop.value, id);
              hasEvents = true;
            }
            continue;
          }
          if (prop.value.type === "Literal") {
            attrs += ` ${prop.key}="${(prop.value as any).value}"`;
          } else {
            // Dynamic attribute
            hasEvents = true;
          }
        } else if (item.type === "StyleBlock") {
          styles.push(this.formatStyleBlock(`#${id}`, item as StyleBlock));
          hasEvents = true; // Needs id in DOM
        } else if (item.type === "EventBlock") {
          onEvent(item as EventBlock, id);
          hasEvents = true;
        } else {
          children += this.emitHtml(item, onEvent, onBind, onCond, onIsland, stateVars, styles);
        }
      }

      if (el.name === "text") {
        if (hasEvents) return `<span id="${id}">${children}</span>`;
        return children;
      }

      if (hasEvents && !attrs.includes(`id="`)) {
        attrs += ` id="${id}"`;
      }

      // React compatibility islands fallback
      if (el.name.charAt(0) === el.name.charAt(0).toUpperCase()) {
        onIsland(id, el.name);
        return `<div id="${id}" data-island="${el.name}"${attrs}>${children}</div>`;
      }

      return `<${el.name}${attrs}>${children}</${el.name}>`;
    }

    if (node.type === "IfStatement") {
      const ifStmt = node as IfStatement;
      const condId = `cond_${this.elementId++}`;
      const testCode = this.exprToJS(ifStmt.test, stateVars);

      let consequentHtml = "";
      for (const child of ifStmt.consequent.body) {
        consequentHtml += this.emitHtml(child, onEvent, onBind, onCond, onIsland, stateVars, styles);
      }
      let out = `<div id="${condId}">${consequentHtml}</div>`;
      onCond(testCode, condId, true);

      if (ifStmt.alternate) {
        const altId = `cond_alt_${this.elementId++}`;
        let altHtml = "";
        for (const child of ifStmt.alternate.body) {
          altHtml += this.emitHtml(child, onEvent, onBind, onCond, onIsland, stateVars, styles);
        }
        out += `<div id="${altId}">${altHtml}</div>`;
        onCond(testCode, altId, false);
      }
      return out;
    }

    if (node.type === "ForStatement") {
      const forStmt = node as ForStatement;
      const listId = `list_${this.elementId++}`;
      const iterableCode = this.exprToJS(forStmt.iterable, stateVars);
      let itemHtml = "";
      for (const child of forStmt.body.body) {
        itemHtml += this.emitHtml(child, onEvent, onBind, onCond, onIsland, stateVars, styles);
      }
      onCond(`Array.isArray(${iterableCode})`, listId, true);
      return `<div id="${listId}" data-keyed-list="${forStmt.variable}">${itemHtml}</div>`;
    }

    if (node.type === "Slot") {
      return `<!-- slot fallback -->`;
    }

    if (node.type === "TextElement") {
      const te = node as TextElement;
      if (te.content.type === "Literal") {
        return (te.content as any).value;
      }
    }
    return "";
  }
}
