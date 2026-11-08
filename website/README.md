# JGrandson documentation website

This is a dependency-free documentation site generated from the current
repository implementation, tests, examples, and roadmap.

Run it locally from the repository root:

```sh
npm run docs:dev
```

Then open `http://localhost:4174`.

Create the dependency-free deployment output with:

```sh
npm run docs:build
```

The generated files are written to `website/dist`.

The site deliberately marks unfinished features as **Preview**, **In progress**,
or **Planned / experimental**. Update those labels when implementation status
changes.
