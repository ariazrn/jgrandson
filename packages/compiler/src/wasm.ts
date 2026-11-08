import { CompilerBackend, CompileResult } from "./backend";
import {
  Program,
  FunctionDeclaration,
  ReturnStatement,
  BinaryExpression,
  Identifier,
  Literal,
  Expression,
  VariableDeclaration,
  IfStatement,
  ForStatement,
} from "@jgrandson/ast";

// WebAssembly binary constants & section IDs
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
const WASM_VERSION = [0x01, 0x00, 0x00, 0x00];

const SECTION_TYPE = 1;
const SECTION_FUNCTION = 3;
const SECTION_MEMORY = 5;
const SECTION_EXPORT = 7;
const SECTION_CODE = 10;
const SECTION_DATA = 11;

// WASM Value Types
const TYPE_I32 = 0x7f;
const TYPE_EMPTY = 0x40;
const TYPE_FUNC = 0x60;

// WASM Control Flow & Variable Opcodes
const OP_BLOCK = 0x02;
const OP_LOOP = 0x03;
const OP_IF = 0x04;
const OP_ELSE = 0x05;
const OP_END = 0x0b;
const OP_BR = 0x0c;
const OP_BR_IF = 0x0d;
const OP_RETURN = 0x0f;
const OP_DROP = 0x1a;

const OP_LOCAL_GET = 0x20;
const OP_LOCAL_SET = 0x21;
const OP_LOCAL_TEE = 0x22;

// Numeric Opcodes
const OP_I32_CONST = 0x41;
const OP_I32_EQ = 0x46;
const OP_I32_NE = 0x47;
const OP_I32_LT_S = 0x48;
const OP_I32_GT_S = 0x4a;
const OP_I32_LE_S = 0x4c;
const OP_I32_GE_S = 0x4e;

const OP_I32_ADD = 0x6a;
const OP_I32_SUB = 0x6b;
const OP_I32_MUL = 0x6c;
const OP_I32_DIV_S = 0x6d;

function encodeSignedLEB128(value: number): number[] {
  const result: number[] = [];
  let more = true;
  while (more) {
    let byte = value & 0x7f;
    value >>= 7;
    if ((value === 0 && (byte & 0x40) === 0) || (value === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    result.push(byte);
  }
  return result;
}

function encodeUnsignedLEB128(value: number): number[] {
  const result: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) {
      byte |= 0x80;
    }
    result.push(byte);
  } while (value !== 0);
  return result;
}

function encodeString(str: string): number[] {
  const bytes = Array.from(Buffer.from(str, "utf8"));
  return [...encodeUnsignedLEB128(bytes.length), ...bytes];
}

function createSection(sectionId: number, payload: number[]): number[] {
  return [sectionId, ...encodeUnsignedLEB128(payload.length), ...payload];
}

interface CompiledWasmFunc {
  name: string;
  paramsCount: number;
  localCount: number;
  paramNames: Map<string, number>;
  codeBytes: number[];
}

interface StringDataSegment {
  offset: number;
  data: number[];
}

export class WasmBackend implements CompilerBackend {
  private stringPool = new Map<string, number>();
  private nextStringOffset = 1024; // reserve low 1KB for scratch
  private dataSegments: StringDataSegment[] = [];

  generate(program: Program): CompileResult {
    const files = new Map<string, string>();
    const diagnostics: [] = [];

    this.stringPool.clear();
    this.nextStringOffset = 1024;
    this.dataSegments = [];

    const unwrappedBody = program.body.map((stmt) =>
      stmt.type === "ExportDeclaration" ? stmt.declaration : stmt
    );

    const pureFunctions: FunctionDeclaration[] = unwrappedBody.filter(
      (stmt): stmt is FunctionDeclaration => stmt.type === "FunctionDeclaration"
    );

    const compiledFuncs: CompiledWasmFunc[] = [];

    for (const fn of pureFunctions) {
      const localIndices = new Map<string, number>();
      let localIndexCounter = 0;

      // 1. Assign index to params
      fn.params.forEach((p) => {
        localIndices.set(p.name, localIndexCounter++);
      });

      // 2. Discover local variables declared inside body
      const discoveredLocals: string[] = [];
      const scanLocals = (statements: any[]) => {
        for (const stmt of statements) {
          if (stmt.type === "VariableDeclaration") {
            const varDecl = stmt as VariableDeclaration;
            for (const d of varDecl.declarations) {
              if (!localIndices.has(d.id)) {
                localIndices.set(d.id, localIndexCounter++);
                discoveredLocals.push(d.id);
              }
            }
          } else if (stmt.type === "ForStatement") {
            const forStmt = stmt as ForStatement;
            if (!localIndices.has(forStmt.variable)) {
              localIndices.set(forStmt.variable, localIndexCounter++);
              discoveredLocals.push(forStmt.variable);
            }
            if (forStmt.body && forStmt.body.body) {
              scanLocals(forStmt.body.body);
            }
          } else if (stmt.type === "IfStatement") {
            const ifStmt = stmt as IfStatement;
            if (ifStmt.consequent && ifStmt.consequent.body) {
              scanLocals(ifStmt.consequent.body);
            }
            if (ifStmt.alternate && ifStmt.alternate.body) {
              scanLocals(ifStmt.alternate.body);
            }
          }
        }
      };

      scanLocals(fn.body);

      const codeBytes: number[] = [];

      // Local entries vector:
      if (discoveredLocals.length > 0) {
        codeBytes.push(1); // 1 group of locals
        codeBytes.push(...encodeUnsignedLEB128(discoveredLocals.length));
        codeBytes.push(TYPE_I32);
      } else {
        codeBytes.push(0); // 0 extra local declarations
      }

      // Compile function body statements
      this.compileStatementList(fn.body, localIndices, codeBytes);

      // Ensure terminating OP_END with fallback return value if needed
      codeBytes.push(OP_I32_CONST, ...encodeSignedLEB128(0));
      codeBytes.push(OP_RETURN);
      codeBytes.push(OP_END);

      compiledFuncs.push({
        name: fn.name,
        paramsCount: fn.params.length,
        localCount: discoveredLocals.length,
        paramNames: localIndices,
        codeBytes,
      });
    }

    if (compiledFuncs.length > 0) {
      const wasmBinary = this.assembleWasm(compiledFuncs);
      const binaryBuffer = Buffer.from(wasmBinary);
      files.set("module.wasm", binaryBuffer.toString("binary"));
      
      const loaderSource = this.generateLoader(compiledFuncs);
      files.set("wasm-loader.ts", loaderSource);
    }

    return { files, diagnostics };
  }

  private compileStatementList(stmts: any[], locals: Map<string, number>, out: number[]): void {
    for (const stmt of stmts) {
      this.compileStatement(stmt, locals, out);
    }
  }

  private compileStatement(stmt: any, locals: Map<string, number>, out: number[]): void {
    if (!stmt) return;

    if (stmt.type === "ReturnStatement") {
      const retStmt = stmt as ReturnStatement;
      if (retStmt.argument) {
        this.compileExpr(retStmt.argument, locals, out);
      } else {
        out.push(OP_I32_CONST, ...encodeSignedLEB128(0));
      }
      out.push(OP_RETURN);
      return;
    }

    if (stmt.type === "VariableDeclaration") {
      const varDecl = stmt as VariableDeclaration;
      for (const d of varDecl.declarations) {
        if (d.init) {
          this.compileExpr(d.init, locals, out);
          const idx = locals.get(d.id)!;
          out.push(OP_LOCAL_SET, ...encodeUnsignedLEB128(idx));
        }
      }
      return;
    }

    if (stmt.type === "ExpressionStatement") {
      this.compileExpr(stmt.expression, locals, out);
      out.push(OP_DROP);
      return;
    }

    if (stmt.type === "IfStatement") {
      const ifStmt = stmt as IfStatement;
      this.compileExpr(ifStmt.test, locals, out);
      out.push(OP_IF, TYPE_EMPTY);
      this.compileStatementList(ifStmt.consequent.body, locals, out);
      if (ifStmt.alternate && ifStmt.alternate.body.length > 0) {
        out.push(OP_ELSE);
        this.compileStatementList(ifStmt.alternate.body, locals, out);
      }
      out.push(OP_END);
      return;
    }

    if (stmt.type === "ForStatement") {
      const forStmt = stmt as ForStatement;
      const varIndex = locals.get(forStmt.variable)!;

      // Initialize loop variable to 0
      out.push(OP_I32_CONST, ...encodeSignedLEB128(0));
      out.push(OP_LOCAL_SET, ...encodeUnsignedLEB128(varIndex));

      out.push(OP_BLOCK, TYPE_EMPTY);
      out.push(OP_LOOP, TYPE_EMPTY);

      // Check condition (var >= limit -> break)
      out.push(OP_LOCAL_GET, ...encodeUnsignedLEB128(varIndex));
      this.compileExpr(forStmt.iterable, locals, out);
      out.push(OP_I32_GE_S);
      out.push(OP_BR_IF, 1);

      // Body
      this.compileStatementList(forStmt.body.body, locals, out);

      // Increment: var = var + 1
      out.push(OP_LOCAL_GET, ...encodeUnsignedLEB128(varIndex));
      out.push(OP_I32_CONST, ...encodeSignedLEB128(1));
      out.push(OP_I32_ADD);
      out.push(OP_LOCAL_SET, ...encodeUnsignedLEB128(varIndex));

      // Repeat loop
      out.push(OP_BR, 0);

      out.push(OP_END); // end loop
      out.push(OP_END); // end block
      return;
    }

    if (stmt.type === "AssignmentExpression") {
      this.compileExpr(stmt, locals, out);
      out.push(OP_DROP);
      return;
    }
  }

  private compileExpr(expr: Expression, locals: Map<string, number>, out: number[]): void {
    if (expr.type === "Literal") {
      const lit = expr as Literal;
      if (typeof lit.value === "number") {
        out.push(OP_I32_CONST, ...encodeSignedLEB128(Math.floor(lit.value)));
      } else if (typeof lit.value === "string") {
        const ptr = this.getStringPointer(lit.value);
        out.push(OP_I32_CONST, ...encodeSignedLEB128(ptr));
      } else if (typeof lit.value === "boolean") {
        out.push(OP_I32_CONST, ...encodeSignedLEB128(lit.value ? 1 : 0));
      } else {
        out.push(OP_I32_CONST, ...encodeSignedLEB128(0));
      }
      return;
    }

    if (expr.type === "Identifier") {
      const id = expr as Identifier;
      const index = locals.get(id.name);
      if (index !== undefined) {
        out.push(OP_LOCAL_GET, ...encodeUnsignedLEB128(index));
      } else {
        out.push(OP_I32_CONST, ...encodeSignedLEB128(0));
      }
      return;
    }

    if (expr.type === "AssignmentExpression") {
      const assign = expr as any;
      if (assign.left && assign.left.type === "Identifier") {
        const varName = assign.left.name;
        const index = locals.get(varName);
        if (index !== undefined) {
          this.compileExpr(assign.right, locals, out);
          out.push(OP_LOCAL_TEE, ...encodeUnsignedLEB128(index));
          return;
        }
      }
    }

    if (expr.type === "BinaryExpression") {
      const bin = expr as BinaryExpression;
      this.compileExpr(bin.left, locals, out);
      this.compileExpr(bin.right, locals, out);

      switch (bin.operator) {
        case "+":
          out.push(OP_I32_ADD);
          break;
        case "-":
          out.push(OP_I32_SUB);
          break;
        case "*":
          out.push(OP_I32_MUL);
          break;
        case "/":
          out.push(OP_I32_DIV_S);
          break;
        case "==":
        case "===":
          out.push(OP_I32_EQ);
          break;
        case "!=":
          out.push(OP_I32_NE);
          break;
        case "<":
          out.push(OP_I32_LT_S);
          break;
        case "<=":
          out.push(OP_I32_LE_S);
          break;
        case ">":
          out.push(OP_I32_GT_S);
          break;
        case ">=":
          out.push(OP_I32_GE_S);
          break;
        default:
          out.push(OP_I32_ADD);
      }
      return;
    }

    // Default fallback
    out.push(OP_I32_CONST, ...encodeSignedLEB128(0));
  }

  private getStringPointer(str: string): number {
    if (this.stringPool.has(str)) {
      return this.stringPool.get(str)!;
    }

    const offset = this.nextStringOffset;
    const utf8Bytes = Array.from(Buffer.from(str, "utf8"));
    const segmentData = [...utf8Bytes, 0];
    this.dataSegments.push({
      offset,
      data: segmentData,
    });

    this.stringPool.set(str, offset);
    this.nextStringOffset += segmentData.length;
    return offset;
  }

  private assembleWasm(funcs: CompiledWasmFunc[]): number[] {
    const bytes: number[] = [...WASM_MAGIC, ...WASM_VERSION];

    // 1. Type Section: define signature for each function (paramCount * i32) -> i32
    const typePayload: number[] = [...encodeUnsignedLEB128(funcs.length)];
    for (const f of funcs) {
      typePayload.push(TYPE_FUNC);
      typePayload.push(...encodeUnsignedLEB128(f.paramsCount));
      for (let i = 0; i < f.paramsCount; i++) {
        typePayload.push(TYPE_I32);
      }
      typePayload.push(1, TYPE_I32);
    }
    bytes.push(...createSection(SECTION_TYPE, typePayload));

    // 2. Function Section: link function index to type index
    const funcPayload: number[] = [
      ...encodeUnsignedLEB128(funcs.length),
      ...funcs.map((_, idx) => idx),
    ];
    bytes.push(...createSection(SECTION_FUNCTION, funcPayload));

    // 3. Memory Section: 1 page (64KB) of linear memory
    const memoryPayload = [
      1, // 1 memory entry
      0x00, // flags: only minimum specified
      1, // minimum 1 page (64KiB)
    ];
    bytes.push(...createSection(SECTION_MEMORY, memoryPayload));

    // 4. Export Section: export each function by name + export memory
    const totalExports = funcs.length + 1;
    const exportPayload: number[] = [...encodeUnsignedLEB128(totalExports)];
    
    // Export functions
    funcs.forEach((f, idx) => {
      exportPayload.push(...encodeString(f.name));
      exportPayload.push(0x00); // export kind: function
      exportPayload.push(...encodeUnsignedLEB128(idx));
    });

    // Export linear memory
    exportPayload.push(...encodeString("memory"));
    exportPayload.push(0x02); // export kind: memory
    exportPayload.push(0x00); // memory index: 0

    bytes.push(...createSection(SECTION_EXPORT, exportPayload));

    // 5. Code Section: function bodies
    const codePayload: number[] = [...encodeUnsignedLEB128(funcs.length)];
    for (const f of funcs) {
      codePayload.push(...encodeUnsignedLEB128(f.codeBytes.length), ...f.codeBytes);
    }
    bytes.push(...createSection(SECTION_CODE, codePayload));

    // 6. Data Section (Active data segments for string constants in linear memory)
    if (this.dataSegments.length > 0) {
      const dataPayload: number[] = [...encodeUnsignedLEB128(this.dataSegments.length)];
      for (const seg of this.dataSegments) {
        dataPayload.push(0x00); // memory index 0
        dataPayload.push(OP_I32_CONST, ...encodeSignedLEB128(seg.offset), OP_END);
        dataPayload.push(...encodeUnsignedLEB128(seg.data.length), ...seg.data);
      }
      bytes.push(...createSection(SECTION_DATA, dataPayload));
    }

    return bytes;
  }

  private generateLoader(funcs: CompiledWasmFunc[]): string {
    const exportTypes = funcs
      .map(
        (f) =>
          `  ${f.name}: (${Array.from({ length: f.paramsCount }, (_, i) => `arg${i}: number`).join(", ")}) => number;`
      )
      .join("\n");

    return `// WebAssembly Module Loader - Generated by JGrandson Compiler

export interface JGWasmExports {
  memory: WebAssembly.Memory;
${exportTypes}
}

export function readWasmString(memory: WebAssembly.Memory, offset: number): string {
  const bytes = new Uint8Array(memory.buffer);
  let end = offset;
  while (bytes[end] !== 0 && end < bytes.length) {
    end++;
  }
  return new TextDecoder("utf-8").decode(bytes.subarray(offset, end));
}

export async function loadJGWasm(wasmBinaryOrUrl?: BufferSource | string): Promise<JGWasmExports> {
  let bytes: BufferSource;
  if (typeof wasmBinaryOrUrl === "string") {
    if (typeof fetch !== "undefined") {
      const response = await fetch(wasmBinaryOrUrl);
      bytes = await response.arrayBuffer();
    } else {
      const fs = await import("node:fs");
      bytes = fs.readFileSync(wasmBinaryOrUrl);
    }
  } else if (wasmBinaryOrUrl) {
    bytes = wasmBinaryOrUrl;
  } else {
    const fs = await import("node:fs");
    const path = await import("node:path");
    bytes = fs.readFileSync(path.join(__dirname, "module.wasm"));
  }

  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports as unknown as JGWasmExports;
}
`;
  }
}
