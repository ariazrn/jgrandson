# JGrandson Architecture Decisions

These decisions set the direction for frontend, backend, and AI work before new
syntax is added. They are intentionally conservative: the parser, analyzer,
formatter, module graph, diagnostics, and editor tooling stay target-independent,
while target-specific behavior lives behind explicit modules and compiler
targets.

## ADR-001: Compiler targets

Status: accepted

JGrandson supports explicit compiler targets instead of inferring behavior from
file names or imported packages.

- `browser` emits React and TypeScript for pages and components.
- `server` emits Node.js TypeScript for routes, services, jobs, and server-only
  standard-library calls.
- `shared` emits TypeScript that is valid from both browser and server modules.

The default project target remains `browser` until the server runtime exists.
Multi-target projects will use project configuration to declare entries and
output directories.

Consequences:

- The compiler API should accept a target option before backend work starts.
- Analyzer rules must know the active target and reject unsupported capabilities.
- Generated browser bundles must never include server runtime helpers.

## ADR-002: Browser/server module boundaries

Status: accepted

Module boundaries are explicit and enforced semantically.

- Browser modules may import `browser` and `shared` modules.
- Server modules may import `server` and `shared` modules.
- Shared modules may import only other `shared` modules.
- Server-only APIs such as secrets, databases, filesystem access, HTTP route
  handlers, AI providers, and background jobs are forbidden from browser and
  shared modules.

The first implementation should represent each module's target in project
configuration. Syntax-level declarations such as `server function` can be
considered later only after the standard-library API proves the need.

Consequences:

- Import resolution must carry module target metadata.
- Diagnostics should report the importing module, imported module, and violated
  boundary.
- The generated browser client for server routes is the only allowed browser
  access path to server behavior.

## ADR-003: Capability permissions

Status: accepted

Powerful runtime features are capabilities with explicit permission metadata.
Capabilities are target-limited and auditable.

Initial capability groups:

- `env`: environment variables and secrets; server only.
- `http`: inbound routes and outbound requests; server first.
- `database`: adapters, migrations, transactions, and query execution; server
  only.
- `storage`: file upload/download and object storage; server only unless a
  generated upload client is used.
- `jobs`: schedules, queues, retries, and idempotency; server only.
- `ai`: model calls, embeddings, tools, agents, evals, tracing, and cost limits;
  server only.

Projects must declare requested capabilities in configuration. The compiler can
then emit deployment manifests, CI checks, and diagnostics before runtime.

Consequences:

- Standard-library imports should map to capability requirements.
- Browser builds fail if they reference a server-only capability.
- Deployment output should list capabilities, secrets, and permissions.

## ADR-004: Provider-neutral AI interface

Status: accepted

AI is a typed server capability. The first implementation should be an ordinary
standard-library API, not dedicated language syntax.

The stable core shape is:

```jg
function summarize(text: string): string {
  return ai.generateText({
    model: "fast",
    prompt: "Summarize clearly: " + text
  })
}
```

Dedicated syntax may be added later only if it improves safety, readability, or
tooling in a way the standard-library API cannot.

The provider-neutral API must support:

- text generation with typed inputs and outputs;
- schema-validated structured output;
- streaming through server functions to browser components;
- tool definitions with validation, timeouts, retries, cancellation, and
  permission checks;
- deterministic mocks for tests;
- tracing, token usage, cost budgets, and redaction controls.

Provider adapters are runtime packages. They receive credentials only through
server-side secret APIs and cannot be referenced from browser modules.

Consequences:

- AI examples must compile through the server target.
- Unit tests must run without network calls.
- Provider-specific details stay outside the language grammar.

## ADR-005: Implementation order

Status: accepted

Backend and AI work should land in this order:

1. Add target metadata to project modules and analyzer diagnostics.
2. Add configuration for browser, server, shared entries, capabilities, and
   output directories.
3. Add server-module import-boundary checks.
4. Add a minimal server TypeScript emitter and runtime.
5. Add typed HTTP routes and generated browser clients.
6. Add secrets and environment APIs, then database adapters.
7. Add provider-neutral AI APIs on top of the server runtime.
8. Add deployment manifests and production adapters.

This keeps the language usable while preventing backend and AI features from
leaking into browser code.
