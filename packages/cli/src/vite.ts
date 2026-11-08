import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

import { analyzeProject, type ProjectModule } from "@jgrandson/analyzer";
import { compile } from "@jgrandson/compiler";
import { parse, SourceError, formatSourceError } from "@jgrandson/parser";
import type { Diagnostic, Program, TopLevelStatement } from "@jgrandson/ast";

export interface JGrandsonVitePluginOptions {
  root?: string;
}

interface LoadedModule {
  file: string;
  source: string;
  program: Program;
  parseDiagnostics: Diagnostic[];
}

interface VitePlugin {
  name: string;
  enforce?: "pre" | "post";
  handleHotUpdate?(ctx: { file: string; server: { moduleGraph: { invalidateAll(): void } } }): void;
  transform?(source: string, id: string): { code: string; map: unknown } | null;
}

function findJgFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return extname(dir) === ".jg" ? [dir] : [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", ".jgrandson"].includes(entry.name) || entry.name.startsWith(".jg-dev-")) continue;
      files.push(...findJgFiles(fullPath));
    } else if (extname(entry.name) === ".jg") {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveImport(fromFile: string, source: string, projectFiles: Set<string>): string | undefined {
  const base = resolve(dirname(fromFile), source);
  const candidates = extname(base) === ".jg" ? [base] : [`${base}.jg`, join(base, "index.jg")];
  return candidates.find((candidate) => projectFiles.has(candidate));
}

function loadModule(file: string): LoadedModule {
  const source = readFileSync(file, "utf8");
  const result = parse(source, file);
  return { file, source, program: result.program, parseDiagnostics: result.diagnostics };
}

function projectModules(modules: LoadedModule[]): ProjectModule[] {
  const projectFiles = new Set(modules.map((module) => module.file));
  return modules.map((module) => {
    const imports = new Map<string, string | undefined>();
    for (const statement of module.program.body) {
      if (statement.type === "ImportDeclaration") {
        imports.set(statement.source, resolveImport(module.file, statement.source, projectFiles));
      }
    }
    return { id: module.file, program: module.program, imports };
  });
}

function throwDiagnostics(source: string, diagnostics: Diagnostic[]): void {
  if (diagnostics.length === 0) return;
  const first = diagnostics[0];
  throw new SourceError(formatSourceError(source, new SourceError(first.message, first.loc)), first.loc);
}

function declarationName(statement: TopLevelStatement): string | undefined {
  if (statement.type === "ExportDeclaration") statement = statement.declaration;
  return statement.type === "ImportDeclaration" ? undefined : (statement as any).name;
}

function rewriteJgImports(code: string, program: Program): string {
  let output = code;
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const source = extname(statement.source) === ".jg" ? statement.source : `${statement.source}.jg`;
    output = output.replaceAll(`from ${JSON.stringify(statement.source)}`, `from ${JSON.stringify(source)}`);
    output = output.replaceAll(`from ${JSON.stringify(`./${statement.name}`)}`, `from ${JSON.stringify(source)}`);
  }
  return output;
}

function inlineSourceMap(id: string, source: string, code: string): unknown {
  return {
    version: 3,
    file: `${id}.tsx`,
    sources: [id],
    sourcesContent: [source],
    names: [],
    mappings: code.split("\n").map(() => "AAAA").join(";"),
  };
}

function compileJgModule(source: string, id: string, root: string): { code: string; map: unknown } {
  const current = parse(source, id);
  throwDiagnostics(source, current.diagnostics);

  const projectFiles = new Set(findJgFiles(root).map((file) => resolve(file)));
  projectFiles.add(resolve(id));
  const modules = [...projectFiles].map((file) =>
    file === resolve(id) ? { file, source, program: current.program, parseDiagnostics: [] } : loadModule(file)
  );
  const analyzable = modules.filter((module) => module.parseDiagnostics.length === 0);
  const semantic = analyzeProject(projectModules(analyzable)).diagnosticsByModule;
  throwDiagnostics(source, semantic.get(resolve(id)) ?? []);

  const combined: Program = {
    type: "Program",
    body: analyzable.flatMap((module) => module.program.body),
    sourceName: root,
    loc: current.program.loc,
  };
  const compiled = compile(combined);
  throwDiagnostics(source, compiled.diagnostics);
  const currentNames = new Set(current.program.body.map(declarationName).filter((name): name is string => Boolean(name)));
  const chunks = [...compiled.files]
    .filter(([fileName]) => currentNames.has(fileName.replace(/\.(tsx|ts)$/, "")))
    .map(([, code]) => rewriteJgImports(code, current.program));
  const defaultName = current.program.body.find(
    (statement) => {
      const unwrapped = statement.type === "ExportDeclaration" ? statement.declaration : statement;
      return unwrapped.type === "Page" || unwrapped.type === "Component";
    }
  );
  const defaultExport = defaultName ? `\nexport default ${declarationName(defaultName)};\n` : "";
  const code = `${chunks.join("\n")}${defaultExport}`;
  return { code, map: inlineSourceMap(id, source, code) };
}

export function jgrandson(options: JGrandsonVitePluginOptions = {}): VitePlugin {
  const root = resolve(options.root ?? process.cwd());
  return {
    name: "jgrandson",
    enforce: "pre",
    handleHotUpdate(ctx) {
      if (extname(ctx.file) === ".jg") ctx.server.moduleGraph.invalidateAll();
    },
    transform(source, id) {
      const cleanId = id.split("?")[0];
      if (extname(cleanId) !== ".jg") return null;
      return compileJgModule(source, cleanId, root);
    },
  };
}
