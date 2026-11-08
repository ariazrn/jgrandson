# Troubleshooting

## `jg: command not found`

If you installed JGrandson globally but your terminal doesn't recognize the `jg` command, make sure your global npm `bin` directory is in your system's `PATH`.

## Dev server fails to start

If `npm run dev` fails, ensure you don't have another service running on port 5173. You can also try cleaning the generated dev cache:

\`\`\`bash
jg clean
\`\`\`

## Type Errors in Editor

If your VS Code extension shows errors that the CLI does not (or vice versa), make sure your extension is up-to-date and matches the version of `@jgrandson/cli` installed in your project workspace.
