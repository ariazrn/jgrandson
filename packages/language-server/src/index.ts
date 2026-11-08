import {
  createConnection,
  TextDocuments,
  Diagnostic as LspDiagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Location,
  Hover,
  Range,
  WorkspaceEdit,
  TextEdit,
  DocumentFormattingParams,
} from "vscode-languageserver/node.js";

import { TextDocument } from "vscode-languageserver-textdocument";

import { parse } from "@jgrandson/parser";
import { analyzeProject } from "@jgrandson/analyzer";
import { formatSource } from "@jgrandson/cli";

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;
  
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [".", "{", "("]
      },
      hoverProvider: true,
      definitionProvider: true,
      renameProvider: true,
      documentFormattingProvider: true,
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

function toLspRange(loc: { start: { line: number; column: number }; end: { line: number; column: number } }): Range {
  return {
    start: { line: loc.start.line - 1, character: loc.start.column - 1 },
    end: { line: loc.end.line - 1, character: loc.end.column - 1 },
  };
}

function findJgFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  if (statSync(dir).isFile()) return extname(dir) === ".jg" ? [dir] : [];
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
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

import { findNodeAtPosition } from "./utils.js";

interface LoadedModule {
  file: string;
  source: string;
  program: any;
  parseDiagnostics: any[];
}

// Keep a map of parsed modules for requests
let lastModules: LoadedModule[] = [];
let lastProjectModulesList: any[] = [];
let lastSemanticDiagnostics: any = new Map();

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const uri = textDocument.uri;
  const filePath = fileURLToPath(uri);
  const text = textDocument.getText();
  
  const parseResult = parse(text, filePath);
  
  const rootDir = dirname(filePath);
  const projectFiles = findJgFiles(rootDir);
  const allFiles = new Set(projectFiles.map(f => resolve(f)));
  allFiles.add(resolve(filePath));

  const modules = Array.from(allFiles).map(file => {
    if (resolve(file) === resolve(filePath)) {
      return { file, source: text, program: parseResult.program, parseDiagnostics: parseResult.diagnostics };
    }
    const source = readFileSync(file, "utf8");
    const result = parse(source, file);
    return { file, source, program: result.program, parseDiagnostics: result.diagnostics };
  });
  
  lastModules = modules;

  const analyzable = modules.filter(m => m.parseDiagnostics.length === 0);
  lastProjectModulesList = analyzable.map(m => {
    const imports = new Map<string, string | undefined>();
    for (const statement of m.program.body) {
      if (statement.type === "ImportDeclaration") {
        imports.set(statement.source, resolveImport(m.file, statement.source, allFiles));
      }
    }
    return { id: m.file, program: m.program, imports };
  });

  lastSemanticDiagnostics = analyzeProject(lastProjectModulesList).diagnosticsByModule;
  
  const currentModule = modules.find(m => resolve(m.file) === resolve(filePath));
  if (!currentModule) return;

  const allDiags = [...currentModule.parseDiagnostics, ...(lastSemanticDiagnostics.get(currentModule.file) || [])];
  
  const diagnostics: LspDiagnostic[] = allDiags.map(diag => {
    return {
      severity: diag.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
      range: toLspRange(diag.loc),
      message: diag.message,
      source: "jgrandson"
    };
  });

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return [
      { label: "page", kind: CompletionItemKind.Keyword },
      { label: "component", kind: CompletionItemKind.Keyword },
      { label: "state", kind: CompletionItemKind.Keyword },
      { label: "style", kind: CompletionItemKind.Keyword }
    ];
  }
);

connection.onHover(
  (params: TextDocumentPositionParams): Hover | null => {
    const filePath = fileURLToPath(params.textDocument.uri);
    const mod = lastModules.find(m => resolve(m.file) === resolve(filePath));
    if (!mod) return null;
    
    // LSP positions are 0-indexed, our AST is 1-indexed
    const line = params.position.line + 1;
    const column = params.position.character + 1;
    
    const node = findNodeAtPosition(mod.program, line, column);
    if (!node) return null;
    
    return {
      contents: {
        kind: "markdown",
        value: `**${node.type}**`
      }
    };
  }
);

connection.onDefinition(
  (params: TextDocumentPositionParams): Location | null => {
    const filePath = fileURLToPath(params.textDocument.uri);
    const mod = lastModules.find(m => resolve(m.file) === resolve(filePath));
    if (!mod) return null;
    
    const line = params.position.line + 1;
    const column = params.position.character + 1;
    
    const node = findNodeAtPosition(mod.program, line, column);
    if (!node) return null;
    
    if (node.type === "Element") {
      // Find component definition
      for (const p of lastProjectModulesList) {
        for (const stmt of p.program.body) {
          let unwrapped = stmt;
          if (stmt.type === "ExportDeclaration") unwrapped = stmt.declaration;
          if (unwrapped.type === "Component" && unwrapped.name === (node as any).name) {
            return {
              uri: "file://" + p.id,
              range: toLspRange(unwrapped.loc)
            };
          }
        }
      }
    }
    return null;
  }
);

connection.onRenameRequest(
  (_params): WorkspaceEdit | null => {
    return null;
  }
);

connection.onDocumentFormatting(
  (params: DocumentFormattingParams): TextEdit[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];
    const text = document.getText();
    try {
      const formatted = formatSource(text);
      return [{
        range: {
          start: document.positionAt(0),
          end: document.positionAt(text.length)
        },
        newText: formatted
      }];
    } catch (e) {
      // If there's a syntax error, formatSource throws. Don't format.
      return [];
    }
  }
);

documents.listen(connection);
connection.listen();
