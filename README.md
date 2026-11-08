# JGrandson

A personal-productivity programming language that lets you describe a web UI
in a single `.jg` file. The current compiler emits **React + TypeScript**; the
planned native target emits direct HTML, CSS, and fine-grained browser JavaScript.

> The local language, Vite development workflow, and 0.3 language-completeness
> sprint are in place. Source files can be checked, formatted, imported directly
> from Vite, built to React + TypeScript, and served by `jg`.

## Layout

```
jgrandson/
├── packages/        # Core tools, TypeScript project references (built in order)
│   ├── ast/         # Source spans, AST nodes, diagnostics
│   ├── lexer/       # Tokenizer:  source → tokens
│   ├── parser/      # Tokens → AST
│   ├── compiler/    # AST → React/TSX
│   └── cli/         # `jg` command
├── examples/        # Sample .jg programs (e.g. Counter)
├── tests/           # Vitest suites (run against source via aliases)
├── docs/            # Language documentation (docs/syntax.md)
├── scripts/         # Helpers (clean.mjs, etc.)
├── package.json     # Root workspace + scripts
```

## Quick Links

- [Installation Guide](docs/installation.md)
- [Tutorial](docs/tutorial.md)
- [Language Syntax Guide](docs/syntax.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Project Roadmap](docs/roadmap.md)
- [Contributing](CONTRIBUTING.md)

## Scripts

| Command         | Description                                 |
| --------------- | ------------------------------------------- |
| `npm run build` | Compile every package with `tsc -b`         |
| `npm run watch` | Incremental rebuild on change               |
| `npm run clean` | Remove all `dist/` + tsbuildinfo files       |
| `npm test`      | Run the Vitest suite (`vitest run`)         |
| `npx jg --help` | The JGrandson command-line interface        |

## Quick start

```sh
npm install        # first time only
npm run build      # build all packages
npx jg --version   # → jgrandson v0.1.0
npm test
```

## Write and preview

Start the live preview once:

```sh
jg dev
```

Then work normally:

```text
write .jg → save → view the update in the browser
```

JGrandson watches the source directory, compiles saved `.jg` files, and lets
Vite update the open browser automatically. Preview dependencies are cached in
`.jgrandson/dev`, so only the first start performs an installation.

Development mode includes React diagnostics, source maps, hot reload, and the
Vite client, so it should not be used for Lighthouse performance measurements.
Audit the optimized production preview instead:

```sh
npm run preview
```

## Install and use

After the packages are published, install the CLI globally:

```sh
npm install --global @jgrandson/cli
jg create hello-jg
cd hello-jg
npm install
npm run dev
```

Or keep the CLI local to a project and invoke it through npm scripts or `npx`:

```sh
npm install --save-dev @jgrandson/cli
npx jg check src
npx jg format src
npx jg build src --out=dist
```

`jg format --check src` verifies formatting without rewriting files. `jg create`
generates a starter `.jg` application and the scripts needed to check, format,
build, and serve it.

## Publishing

The compiler packages must be published before the CLI because the CLI depends
on them. Verify the package contents and then publish in dependency order:

```sh
npm run pack:check
npm login
npm run publish:packages
```

The `@jgrandson` npm scope must belong to the publishing account or organization.
Publishing is the only release step that requires npm credentials; local builds
and package verification do not.

## Packages

| `@jgrandson/ast`      | Tokens, source spans, AST node types & diagnostics |
| `@jgrandson/lexer`    | Tokenizer (`tokenize`, `Token`, `SourceError`)      |
| `@jgrandson/parser`   | Tokens → AST                                         |
| `@jgrandson/analyzer` | Symbols, types, and semantic diagnostics             |
| `@jgrandson/compiler` | AST → React/TSX                                      |
| `@jgrandson/cli`      | `jg` command runner (`dev`/`build`/`check`/…)       |

See [docs/roadmap.md](docs/roadmap.md) for the milestones from the current MVP
to the stable 1.0 language.

VS Code language support, including the dedicated `.jg` file icon and syntax
highlighting, lives in [editors/vscode-jgrandson](editors/vscode-jgrandson).

## Status

| Sprint | Milestone                                | Done |
| ------ | ---------------------------------------- | ---- |
| MVP    | Compiler demo baseline                   | ✓    |
| 0.1    | Reliable local language                  | ✓    |
| 0.2    | Real project and development experience  | ✓    |
| 0.3    | Language completeness                    | ✓    |
| 0.4    | Tooling ecosystem                        | ✓    |
| 0.5    | Package release and adoption             | ✓    |
| 0.6    | Backend and data runtime                 | in progress |
| 0.7    | Native web compiler and performance      | planned |
| 0.8–0.9 | AI and full-stack deployment            | planned |
| 0.10–0.16 | Special compiler track                | planned |

---

MIT licensed.
