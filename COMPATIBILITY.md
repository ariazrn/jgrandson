# JGrandson Compatibility & Deprecation Policy (1.0 Core)

## Semantic Versioning Guarantees
JGrandson follows Semantic Versioning (SemVer 2.0.0).

- **1.x releases** will never introduce breaking syntactic changes or change runtime behavior of stable declarations (`page`, `component`, `function`, `route`, `tool`, `state`, `style`, `ai`).
- **Deprecations** will always emit a compiler warning for at least one minor release cycle before removal in a subsequent major version.
- **Diagnostics and Explain Codes** (e.g. `JG-EXP-*`, `JG-PROV-*`, `JG-BUDGET-*`, `JG-UX-*`) are guaranteed to remain stable for IDE, tooling, and CI pipeline integrations.

## Target Parity
Both the **React Backend** and **Native Backend** are supported first-class targets:
- Static pages emit zero client JavaScript by default.
- Interactive pages emit direct DOM bindings with dependency-level precision.
- React components remain fully supported through isolated compatibility islands (`data-island`).

## AI and Data Provenance Authority
- AI features are treated as typed capabilities governed by explicit authority rules (proposal vs execution).
- Provenance qualifiers (`user`, `server`, `database`, `cache`, `external`, `ai`) are preserved through round-trips to prevent unvalidated data flow into critical sinks.
