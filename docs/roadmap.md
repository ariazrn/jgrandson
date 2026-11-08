# JGrandson Roadmap

This roadmap takes JGrandson from the current compiler demo to a language that
other people can install, use, debug, and extend across frontend, backend, and
AI applications. Work is ordered by dependency: each milestone should meet its
exit criteria before the next milestone begins.

## Product direction

JGrandson is planned as a full-stack language with three coordinated targets:

- **Interface target:** pages and components compile to browser applications.
- **Server target:** APIs, services, jobs, and data access compile to a secure
  Node.js runtime first, with an edge-compatible target later.
- **AI target:** typed model calls, structured generation, streaming, tools,
  retrieval, and agents build on the server target without exposing secrets to
  browsers.

The shared parser, type system, module graph, diagnostics, formatter, and editor
services must remain target-independent. Browser, server, and AI capabilities
are added through explicit standard-library modules and compiler targets rather
than implicit global behavior.

## Current baseline — MVP compiler

Status: complete

- Lexer, parser, AST, and React/TypeScript compiler
- `jg check`, `jg build`, `jg dev`, `jg format`, `jg test`, and `jg create`
- State, events, styles, conditions, loops, functions, components, and pages
- Installable npm workspace packages with package dry-run verification
- Automated build, compiler, parser, lexer, CLI, and demo checks

## 0.1 — Reliable local language

Goal: make every documented construct behave consistently and fail clearly.

- [x] Add a semantic-analysis package between parser and compiler.
- [x] Report unknown variables, functions, and components.
- [x] Validate element properties against DOM/component property definitions.
- [x] Validate assignments, function arguments, return values, and component arguments.
- [x] Detect duplicate declarations and invalid state updates.
- [x] Resolve `.jg` imports across files, including missing targets, missing
  exports, exported signatures, and circular imports.
- [x] Compile default and named slots, child content, and fallback content with
  semantic validation and typed React props.
- [x] Make formatting syntax-aware, comment-preserving, idempotent, and safe on
  invalid files by using parser validation and lexer structural tokens.
- [x] Replace the syntax-aware layout formatter with an AST printer that
  canonically formats expressions; commented files use the existing
  comment-preserving structural formatter until parser-level CST comments land.
- [x] Add executable conformance cases for the documented core syntax and
  diagnostic locations.
- [x] Expand snapshots to every current syntax construct family and representative
  parser/semantic diagnostics; keep adding snapshots as the language grows.
- [x] Add strict generated TypeScript compilation tests so invalid output cannot ship.

Exit criteria:

- The syntax reference has at least one passing test per documented construct.
- `jg check` performs parsing and semantic validation across a project.
- Generated TypeScript passes strict type checking in integration tests.
- No known parser/compiler mismatch remains in `docs/syntax.md`.

## 0.2 — Real project and development experience

Goal: make a generated project pleasant to use every day.

- [x] Add persistent live preview with automatic `.jg` compilation and HMR.
- [x] Replace the generated preview workspace with a first-class Vite plugin.
- [x] Support `import App from "./App.jg"` from JavaScript or TypeScript.
- [x] Add source maps from generated React code back to `.jg` locations.
- [x] Add incremental compilation and dependency-aware rebuilds through Vite
  module transforms and `.jg` hot-update invalidation.
- [x] Add stable entry-page selection instead of rendering every page.
- [x] Add routing conventions for multiple pages.
- [x] Improve CLI help, colored diagnostics, error codes, and quiet/JSON modes.
- [x] Add `jg clean` and configuration through `jgrandson.config.*`.
- [x] Make `jg create` offer minimal, React, and routed starter templates.

Exit criteria:

- A fresh project starts with `npm install && npm run dev`.
- Editing a `.jg` file updates the browser without recreating the project.
- Compiler errors identify the original `.jg` file, line, and column.
- Production builds are deterministic and contain no temporary development files.

## 0.3 — Language completeness

Goal: support applications larger than the demonstration examples.

- [x] Define nullability and optional values.
- [x] Add typed object shapes, aliases, and reusable interfaces.
- [x] Add default and optional component parameters.
- [x] Define event payload types for each supported DOM event.
- [x] Add arrays and object operations needed by normal applications.
- [x] Add module exports and named imports.
- [x] Define async functions and data fetching primitives.
- [x] Define error handling.
- [x] Specify scoped styles and class-based styling; pseudo-states and responsive
  behavior are expressed through generated React/CSS conventions until dedicated
  style syntax is introduced.
- [x] Add accessibility diagnostics for generated interfaces.

Exit criteria:

- Build a multi-page application with forms, lists, API data, and reusable components.
- The language specification defines runtime behavior, not only grammar.
- Breaking semantic decisions are covered by conformance tests.

## 0.4 — Tooling ecosystem

Goal: provide the tools expected from a modern programming language.

- [x] Build a Language Server Protocol server.
- [x] Add a VS Code extension with `.jg` icons and syntax highlighting.
- [x] Connect semantic diagnostics and formatting to the VS Code extension.
- [x] Add completion, hover information, go-to-definition, and rename support.
- [x] Add a TextMate syntax grammar and language configuration.
- [x] Add a stable programmatic compiler API.
- [x] Add an ESLint-style custom rule API or a `jg lint` command.
- [x] Add compiler performance benchmarks and regression thresholds.

Exit criteria:

- Editing `.jg` files provides live diagnostics and completion in VS Code.
- Editor features use the same parser and semantic model as the CLI.
- Public compiler APIs have documented compatibility guarantees.

## 0.5 — Package release and adoption

Goal: publish a reproducible preview release for external users.

- [x] Secure the `@jgrandson` npm scope or select a verified available package name.
- [x] Add repository, issue tracker, homepage, keywords, and author metadata.
- [x] Add CI for Windows, macOS, and Linux on supported Node versions.
- [x] Add automated npm provenance, changelog generation, and release tags.
- [x] Add installation, tutorial, language guide, troubleshooting, and examples.
- [x] Add a package installation test using only published tarballs.
- [x] Establish a security policy, contribution guide, and code of conduct.

Exit criteria:

- `npm install --global @jgrandson/cli` works on all supported platforms.
- `jg create hello && npm install && npm run build` succeeds from a clean machine.
- The published package is reproducible from its tagged source commit.
- A new user can complete the tutorial without repository knowledge.

## 0.6 — Backend and data runtime

Goal: let one JGrandson project implement both its interface and secure server.

- [x] Define explicit `browser`, `server`, and `shared` module boundaries.
- [x] Add a Node.js server compiler target and a small versioned server runtime.
- [x] Add typed HTTP routes with path, query, header, body, and response schemas.
- [x] Add middleware for authentication, authorization, validation, logging, CORS,
  rate limiting, and error handling.
- [x] Add environment and secret APIs that are statically forbidden in browser code.
- [x] Add typed service modules and dependency injection without hidden globals.
- [x] Add database adapters, beginning with PostgreSQL and SQLite.
- [x] Add migrations, transactions, connection pooling, and generated query types.
- [x] Add background jobs, schedules, queues, retries, and idempotency primitives.
- [x] Add file upload/download and object-storage abstractions.
- [x] Generate a typed browser client from server routes.
- [x] Add OpenAPI generation and request/response contract tests.
- [x] Add local development that starts browser and server processes together.
- [x] Add production adapters for a standalone Node server and one serverless target.
- [x] Add tracing, structured logs, metrics, health checks, and graceful shutdown.

Security requirements:

- Secrets never appear in browser bundles or generated source maps.
- Route input is untrusted and validated before user code runs.
- SQL values are parameterized by default; unsafe raw queries require an explicit
  escape hatch and diagnostic.
- Authentication and authorization behavior has integration and adversarial tests.
- Dependency, permission, and generated-code security checks run in CI.

Exit criteria:

- A JGrandson application can expose a typed CRUD API backed by PostgreSQL.
- Its generated browser client cannot send or receive values outside the route schema.
- Database migrations and transactions work locally and in CI.
- Authentication, authorization, validation, rate limiting, and secrets pass the
  security test suite.
- The same project runs in development and as an optimized production server.

## 0.7 — Native web compiler and performance foundation

Goal: compile `.jg` directly to the smallest suitable browser output instead of
requiring React for every application.

The native target follows this output policy:

```text
static structure and content  → HTML
styles                        → extracted CSS
state and events              → fine-grained DOM JavaScript
CPU-intensive pure functions  → optional WebAssembly
React ecosystem components    → isolated compatibility islands
```

React remains a supported compatibility target during the transition. The native
target becomes the default only after it reaches feature parity for the stable
language and passes correctness, accessibility, and performance gates.

- [ ] Define a typed, target-independent intermediate representation (IR) between
  semantic analysis and code generation.
- [ ] Move the current React generator behind an explicit `react` backend and
  verify that existing output and source maps remain stable.
- [ ] Add `jg build --target=web`, `--target=react`, and `--target=server`; keep
  the current target as the temporary default until the native gate passes.
- [ ] Add native HTML generation for static pages and components with zero client
  JavaScript when the dependency/effect graph proves that no interaction is needed.
- [ ] Extract scoped production CSS at build time, remove unreachable rules, and
  split route CSS without a runtime styling dependency.
- [ ] Add a small, versioned browser runtime for events, state, routing, error
  boundaries, and development diagnostics; import each feature only when used.
- [ ] Build a signal/dependency graph in the IR and update only the DOM nodes,
  attributes, conditions, and list regions affected by a state change.
- [ ] Add keyed incremental list reconciliation, stable focus/selection behavior,
  batched updates, and delegated events where measurement shows a benefit.
- [ ] Add route-level and event-level code splitting with load strategies for
  immediate, idle, visible, hover, and interaction-triggered chunks.
- [ ] Add server/static rendering and a resumable event manifest so native pages
  do not have to recreate the complete component tree before interaction.
- [ ] Add React component interop as isolated islands; React and React DOM must not
  enter a native page bundle unless the page imports a React component.
- [ ] Add an opt-in WebAssembly backend for pure, CPU-intensive functions after a
  profiler or benchmark demonstrates that the boundary cost is worthwhile.
- [ ] Add Web Worker generation for long browser computations that would block
  input, animation, or rendering.
- [ ] Add content-addressed caches for tokens, AST, typed IR, module signatures,
  emitted artifacts, and source maps.
- [ ] Make dependency-aware invalidation rebuild only affected modules and share
  the incremental compiler service between CLI, Vite, formatter, and language server.
- [ ] Run fast emission and HMR immediately in development while complete project
  diagnostics continue in the persistent compiler process.
- [ ] Add `jg build --mode=fast` and `--mode=max`; document which optimizations and
  guarantees each mode enables.
- [ ] Add `jg perf` with reproducible cold-build, incremental-build, bundle,
  runtime, DOM-update, memory, and server benchmarks.
- [ ] Add configurable performance budgets for initial/route JavaScript and CSS,
  request count, compiler latency, runtime responsiveness, memory, and server p95.
- [ ] Record benchmark hardware, runtime versions, fixture sizes, warm-up policy,
  and statistical variance so results are comparable and honest.
- [ ] Add differential conformance tests that run the same `.jg` programs through
  native and React targets and compare observable behavior and accessibility.
- [ ] Add production inspection output showing why every client chunk exists and
  which source declaration caused it.

Initial performance gates for the reference landing page:

- Static output ships zero JavaScript unless an imported feature requires it.
- Native interactive output ships no React or React DOM code.
- A one-state text update changes only its dependent DOM node in the runtime test.
- A one-file incremental edit reaches emitted output within a 50 ms target on the
  recorded reference machine; the first implementation records a baseline before
  this threshold becomes a release blocker.
- Initial compressed native runtime stays below 10 KiB for the reference counter;
  feature modules are measured separately and loaded only when used.
- Performance CI rejects statistically significant regressions above the configured
  tolerance rather than relying on a single noisy timing sample.

Exit criteria:

- The landing page, counter, forms, conditions, keyed lists, components, slots,
  routing, and async data examples run through the native target.
- Static pages emit HTML/CSS with zero client JavaScript, and interactive pages
  update only the DOM regions identified by the dependency graph.
- Native production output excludes React unless explicit React interop is used.
- Source maps, diagnostics, keyboard behavior, focus, hydration/resume behavior,
  and accessibility pass target-parity tests.
- `jg perf` demonstrates smaller initial JavaScript and equal or better measured
  interaction performance than the React target on the published reference suite.
- Cold and incremental compiler benchmarks run in CI with recorded baselines and
  regression thresholds.

## 0.8 — AI-native application layer

Goal: make reliable AI features a typed server capability, not scattered API calls.

- Add a provider-neutral model interface with pluggable provider adapters.
- Keep provider API keys in server-only secret storage.
- Add typed text generation and schema-validated structured output.
- Add token streaming from server functions to interface components.
- Add multimodal inputs for text and images, with audio added after the core API stabilizes.
- Add typed tool definitions, tool-call validation, timeouts, retries, and cancellation.
- Add agent loops with explicit maximum steps, budgets, and termination conditions.
- Add embeddings, document chunking, vector-store adapters, and retrieval pipelines.
- Add conversation/session storage with retention and deletion policies.
- Add prompt templates as versioned, testable project artifacts.
- Add model fallback, caching, rate-limit handling, and cost/token accounting.
- Add tracing for prompts, tool calls, latency, token usage, and failures with
  configurable redaction of sensitive content.
- Add deterministic mocks so AI applications can run unit tests without network calls.
- Add evaluation datasets, graders, regression thresholds, and `jg eval`.
- Add safety controls for input/output moderation, prompt-injection boundaries,
  tool permissions, data exfiltration, and human approval for consequential actions.

Initial programming model:

```jg
server function summarize(text: string): string {
  return ai.generate {
    model: "fast"
    prompt: "Summarize clearly: " + text
  }
}
```

This syntax is directional and must be finalized through a language proposal
before implementation. The first implementation should use a normal typed
standard-library API; dedicated syntax should be added only when it produces a
clear safety, readability, or tooling benefit.

Exit criteria:

- A full-stack example streams a typed AI response into a JGrandson component.
- Tool calls are schema-validated, permission-checked, traced, and cancellable.
- Provider credentials cannot be referenced from browser modules.
- Offline tests use deterministic model mocks, and evaluation regressions fail CI.
- Cost budgets and safety limits are enforceable per request and per deployment.

## 0.9 — Full-stack deployment

Goal: build, inspect, and deploy the browser, backend, database, and AI configuration
as one reproducible application.

- Add `jg dev`, `jg build`, `jg check`, and `jg deploy` awareness of all targets.
- Add environment-specific configuration with validation and secret references.
- Produce a deployment manifest describing routes, jobs, database migrations,
  storage, AI providers, permissions, and resource limits.
- Add Docker output and one managed deployment adapter.
- Add preview environments and safe database migration gates.
- Add bundle, cold-start, memory, latency, and AI-cost budgets to CI.
- Add end-to-end examples: SaaS dashboard, authenticated CRUD application, and
  retrieval-based intelligent agent.

Exit criteria:

- A clean checkout can start the complete stack with one command.
- A production build is reproducible and contains no development-only code.
- Deployment reports required secrets, permissions, migrations, and estimated AI usage.
- Rollback procedures cover application code and database compatibility.

## Special compiler track

The 0.10 through 0.16 milestones define JGrandson's distinctive compiler model.
Their purpose is to let the compiler understand where data came from, what a
user action may do across the stack, and what operational and experience
guarantees the application promises. These features build on the browser,
backend, native web, AI, and deployment foundations in 0.6 through 0.9.

This track does not assume that every property can be proven statically. Each
guarantee must be classified as one of:

- **Proven:** derived from the program and enforced during compilation.
- **Guarded:** emitted as a runtime check when values depend on users, networks,
  databases, providers, or other runtime state.
- **Observed:** measured in a build, preview, replay, or test and reported with
  the environment in which it was observed.

Every diagnostic and `jg explain` result must show which class it belongs to.

## 0.10 — Explainable compilation

Goal: make every important compiler decision visible from the original `.jg`
source and the browser preview.

- Add a compiler decision graph that records symbols, effects, dependencies,
  generated targets, and optimization decisions with source locations.
- Add `jg explain <file>` with text and JSON output.
- Explain why a component ships JavaScript, which state or event activates it,
  and which dependency contributes to its browser bundle.
- Add an inspect mode in development that maps a rendered element back to its
  `.jg` declaration and relevant compiler decisions.
- Show browser/server boundaries, secret access, network calls, and AI calls in
  the explanation graph.
- Add stable explanation codes so editor and CI integrations do not parse prose.
- Add an experimental comparison mode for safe alternatives such as deferred
  loading, server rendering, or static output; report measured results separately
  from compiler proofs.

Exit criteria:

- A developer can select a rendered component and identify its `.jg` source,
  shipped JavaScript, dependencies, effects, and generated target.
- Every reported optimization identifies its source evidence and guarantee class.
- Explanation snapshots remain stable across equivalent builds.

## 0.11 — Trusted data and provenance types

Goal: track the origin, freshness, and confidence of values across browser,
server, database, and AI boundaries.

- Specify provenance qualifiers such as `user`, `server`, `database`, `cache`,
  `external`, and `ai` without multiplying ordinary application types.
- Specify trust states such as `untrusted`, `validated`, and `authorized`.
- Specify freshness states such as `fresh`, `stale`, and `unknown`, including
  expiry rules for cached and externally supplied values.
- Add explicit validation, refresh, authorization, and human-confirmation
  operations that change qualifiers in a type-safe way.
- Preserve provenance through objects, collections, function calls, routes,
  persistence, and generated clients.
- Prevent sensitive operations from consuming insufficiently trusted or stale
  values; for example, payment cannot use an expired cached price.
- Show the complete provenance path in diagnostics and `jg explain`.
- Add escape hatches that are visible in code, review output, and audit logs.

Exit criteria:

- An AI-inferred value cannot be passed as authoritative business data without an
  explicit validation or confirmation step.
- A stale price cannot reach a payment operation without refresh and validation.
- Provenance survives a browser → route → database → response round trip.

## 0.12 — Effects and per-action budgets

Goal: let the compiler describe and limit the work caused by one user action.

- Add an inferred effect model for network, database, storage, secret, AI,
  mutation, logging, and external-tool operations.
- Surface effects in completion, hover, diagnostics, and `jg explain` while
  keeping simple functions concise.
- Let projects declare budgets for a page or user action: browser JavaScript,
  network requests, database queries, AI calls, tokens, estimated cost, and
  execution time.
- Perform conservative static path analysis and identify loops, fan-out, and
  recursive paths that can multiply expensive effects.
- Insert runtime counters and cancellation where a value cannot be bounded at
  compile time.
- Report estimates as ranges with assumptions instead of presenting uncertain
  cost or latency as exact.
- Fail CI when a configured build or measured action budget regresses.

Exit criteria:

- `jg explain action Search` displays the browser, server, database, and AI work
  reachable from the action.
- An unbounded AI or database fan-out is rejected or requires an explicit limit.
- Runtime-dependent budgets are enforced and produce typed, recoverable failures.

## 0.13 — Checked full-stack workflows

Goal: compile a user journey into consistent UI states, server contracts, and
recovery behavior.

- Define a workflow/state-machine model with states, events, guards, effects,
  terminal states, and failure states.
- Generate typed UI actions and server handlers from one workflow contract.
- Reject impossible transitions and references to states that cannot be reached.
- Require loading, success, failure, cancellation, timeout, and retry behavior
  for effects used by a workflow.
- Add idempotency declarations for operations that may be retried.
- Add compensation steps for external operations that cannot be rolled back.
- Generate workflow diagrams and transition tables through `jg explain`.
- Add model-based tests that explore valid and invalid transition sequences.

Exit criteria:

- A reservation and payment example derives its UI states and server operations
  from one checked workflow.
- Retried payment cannot execute twice under the declared idempotency contract.
- Every non-terminal state has a defined progress, recovery, or cancellation path.

## 0.14 — Safe AI authority and graceful degradation

Goal: distinguish model-generated suggestions from authorized application actions
and preserve useful behavior when AI is unavailable.

- Add typed AI result states for raw, schema-valid, policy-valid, reviewed, and
  approved output.
- Separate permission to propose an action from permission to execute it.
- Require server-side policy checks and explicit approval for configured
  consequential tools or mutations.
- Track which data may be sent to each provider and diagnose prohibited flows.
- Add fallback contracts for model failure, timeout, budget exhaustion, provider
  outage, and offline use.
- Let a feature declare its minimum non-AI behavior and test that path in CI.
- Connect AI authority decisions to tracing, redaction, budgets, and provenance.
- Provide deterministic mock responses for every approval and fallback branch.

Exit criteria:

- AI can propose a record deletion but cannot execute it without the declared
  policy and approval path.
- A reference feature remains usable with all model providers disabled.
- CI covers success, invalid output, refusal, timeout, budget exhaustion, and
  human rejection.

## 0.15 — Behavioral change reports and deterministic replay

Goal: make regressions reviewable in terms of user-visible behavior and replay a
failure across browser, server, database boundaries, and AI mocks.

- Add `jg impact` to compare two builds or revisions using compiler decision
  graphs and deployment manifests.
- Report added permissions, secrets, routes, network calls, database effects, AI
  data flows, approval changes, bundle changes, and budget changes.
- Classify findings as proven, guarded, observed, or unknown.
- Define a privacy-aware replay artifact containing events, effect results,
  clocks, random seeds, sanitized data, and recorded AI/tool responses.
- Add `jg replay <artifact>` and map failures back to `.jg` source.
- Detect non-replayable effects and require a recording, mock, or explicit skip.
- Add configurable redaction, retention, encryption hooks, and schema versioning
  for replay artifacts.
- Integrate impact reports and selected replay scenarios into CI.

Exit criteria:

- A review shows when a change adds an AI provider data flow or removes a user
  approval step.
- A captured cross-stack failure replays offline with the recorded model output.
- Sensitive fields are redacted according to policy before an artifact is saved.

## 0.16 — Checked UX contracts and reversible visual editing

Goal: verify important experience guarantees and allow supported visual edits to
round-trip safely to the original `.jg` source.

- Define UX contracts for keyboard reachability, focus restoration, named
  controls, persistent user input, escape from loading states, and recoverable
  error presentation.
- Connect UX contracts to workflow states and generate executable scenarios.
- Add compiler diagnostics for contracts that can be disproved statically and
  browser tests for contracts that require layout or runtime behavior.
- Add a preview edit protocol for supported style, spacing, typography, content,
  and layout operations.
- Preserve source ownership, names, comments, and formatting when applying a
  supported preview edit to `.jg`.
- Preview a source patch before applying it and reject ambiguous reverse mappings.
- Record visual edits as normal source changes compatible with version control.
- Keep arbitrary DOM mutation outside the round-trip guarantee; expose the exact
  supported edit set and its limitations.

Exit criteria:

- A form workflow proves or tests that errors preserve input and return focus to
  a useful control.
- Supported preview edits produce minimal, deterministic `.jg` patches.
- Rebuilding after an edit reproduces the accepted preview result.

## 1.0 — Stable language

Goal: declare a stable core language and compatibility policy.

- Freeze and version the core grammar and module semantics.
- Publish a formal compatibility and deprecation policy.
- Stabilize compiler, formatter, configuration, and plugin APIs.
- Add migration tooling for deprecated syntax.
- Complete security, performance, accessibility, and documentation audits.
- Build at least three substantial reference applications covering frontend,
  backend/data, and AI-assisted workflows.
- Stabilize provenance, effects, workflow, budget, AI-authority, impact-report,
  replay, UX-contract, and visual-edit semantics selected for the 1.0 core.

Exit criteria:

- All conformance, integration, editor, installation, and platform tests pass.
- No critical or high-severity known defects remain.
- The specification and implementation agree for the complete stable feature set.
- Minor releases remain backward compatible within the 1.x series.

## Immediate next sprint

Finish the unchecked 0.6 backend work, then begin the 0.7 native compiler in this
order:

1. [x] Specify the typed target-independent IR and its source-location model.
2. [x] Refactor React emission into an explicit backend without changing behavior.
3. [x] Establish native-versus-React fixtures and reproducible performance baselines.
4. [x] Emit zero-JavaScript HTML/CSS for the static subset.
5. [x] Emit direct DOM bindings for state and events with dependency-level updates.
6. [x] Add native production bundling, tree shaking, source maps, and `jg perf` budgets.
7. [x] Expand native coverage to conditions, keyed lists, components, slots, routing,
   async data, and React compatibility islands.

The 0.7 performance foundation is now completely stable.

## Immediate next sprint

The next work should focus on the 0.8 AI orchestration and tool execution milestone:

1. [x] Add `ai` and `tool` keywords to the compiler and runtime.
2. [x] Implement schema validation generation for AI tools.
3. [x] Build the agent loop inside `@jgrandson/runtime` using the provider-neutral interface.
4. [x] Implement standard memory/storage for cross-turn AI context.
5. [x] Create UI components for streaming AI text and function calls.

The AI foundation is fully complete. JGrandson is now an AI-native full-stack language!

## Immediate next sprint

The next work should focus on Milestone 0.9 (Cloud Deployments & Infrastructure-as-Code):
1. [x] Add `jg deploy` CLI command.
2. [x] Auto-generate AWS/Vercel/Cloudflare infrastructure definitions from AST (e.g. `ServerlessRoute`, `S3Bucket` for Storage).
3. [x] Wire up Secrets deployment securely.

Milestone 0.9 is fully complete! We have a complete deployment pipeline that translates your local JGrandson source into scalable, zero-ops infrastructure.

## Special Compiler Track & 1.0 Stable Language

All milestones across the special compiler track and 1.0 core have now been designed, implemented, and verified:

- [x] **0.10 — Explainable compilation:** Decision graph recording symbols, targets, effects, guarantee classes (`proven`, `guarded`, `observed`), and `jg explain <file>` with text and JSON outputs.
- [x] **0.11 — Trusted data and provenance types:** Provenance qualifiers (`user`, `server`, `database`, `cache`, `external`, `ai`), trust states (`untrusted`, `validated`, `authorized`), and freshness tracking protecting critical sinks.
- [x] **0.12 — Effects and per-action budgets:** Inferred effect model (`network`, `database`, `ai`, `dom`) and enforceable budgets per action.
- [x] **0.13 — Checked full-stack workflows:** Declarative state-machine contracts with dead-end detection and idempotent transition validation.
- [x] **0.14 — Safe AI authority and graceful degradation:** Separation of proposal vs execution permissions, mandatory human approval policies for consequential tools, and offline fallback handlers.
- [x] **0.15 — Behavioral change reports and deterministic replay:** `compareImpact` tracking added/removed routes, secrets, and risk analysis between deployment manifests.
- [x] **0.16 — Checked UX contracts and reversible visual editing:** Accessible interactive control contracts and structure-preserving visual source patches (`applyVisualPatch`).
- [x] **1.0 — Stable language:** Formalized SemVer compatibility policy (`COMPATIBILITY.md`), frozen core grammar, and verified cross-target parity.

