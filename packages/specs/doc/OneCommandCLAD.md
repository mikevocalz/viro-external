# One-command CLAD runner

With Lens Studio already open and its MCP server running, the Viro Specs package
can prepare Codex and optionally launch the full CLAD finish loop from one
command.

## Prepare only

```bash
pnpm --filter @viro-external/specs specs:go -- \
  --project "/absolute/path/to/MySpecsProject"
```

This runs the project doctor, syncs the runtime, verifies Codex, probes the Lens
Studio MCP, adds the official Lens Studio extension marketplace, enables
`ls-clad@ls-extensions` in project Codex configuration, configures an explicit
`lens-studio` MCP fallback, and applies Snap's recommended approval settings
when the installed Codex version supports them.

The default MCP endpoint is:

```text
http://localhost:50040/mcp
```

Override it when Lens Studio chooses a different port:

```bash
pnpm --filter @viro-external/specs specs:go -- \
  --project "/path/to/project" \
  --mcp-url "http://localhost:50041/mcp"
```

## Run CLAD autonomously

After `ls-clad` is installed once, run:

```bash
pnpm --filter @viro-external/specs specs:go -- \
  --project "/absolute/path/to/MySpecsProject" \
  --exec
```

That launches a non-interactive Codex execution from the Lens project folder
using the generated `VIRO_SPECS_CLAD_FINISH.md` prompt.

A complete closed-loop build/verification pass can take 30+ minutes.

## One interactive step may still be required

Snap's current Codex setup documents installation of `ls-clad` through the
Codex plugin browser. If this machine has never installed it, open Codex once,
run `/plugins`, select the `ls-extensions` marketplace and install
**ls-clad**.

The runner intentionally does not guess an undocumented plugin-install command.
