# One-command CLAD runner

Save the SPECS project to a durable folder, open it in Lens Studio 5.22+, and
start Lens Studio's MCP server. Install workspace dependencies with `pnpm install`
and make sure `codex` is on your PATH. The project must target Spectacles/SPECS.

## Prepare the project

```bash
pnpm --filter @viro-external/specs specs:go -- \
  --project "/absolute/path/to/MySpecsProject"
```

The runner:

- Checks the saved project and installed Codex CLI.
- Reads the existing `lens-studio` MCP settings from user and project Codex
  configuration, including static `http_headers`, `env_http_headers`, and
  `bearer_token_env_var` authentication.
- Sends an authenticated MCP `initialize` request and validates the JSON-RPC
  response. HTTP 401/403, server errors, and malformed responses stop setup.
- Installs `ls-clad@ls-extensions` with `codex plugin add` if needed, adding the
  official `lens-studio-devs/ls-extensions` marketplace only when absent.
- Merges the MCP endpoint and CLAD enablement into the project's
  `.codex/config.toml`, preserving other settings and authentication. Ordinary
  table-based config also retains comments; unusual inline table layouts may be
  reformatted without changing their values. Repeated runs are idempotent, and
  duplicate managed blocks from the old runner are repaired.
- Checks that Codex actually loads the same authenticated MCP configuration from
  the project directory.
- Syncs `Assets/ViroSpecs/lens/` and writes `VIRO_SPECS_CLAD_FINISH.md`. Existing
  `.meta` files and their Lens asset identities are preserved on every resync.

Preparation does not launch an AI task, install Lens packages, or assemble the
scene. The CLAD finish prompt handles those steps. The runner does not change
user-wide approval settings or register a global MCP fallback.

The endpoint is selected in this order: `--mcp-url`, `VIRO_SPECS_MCP_URL`, existing
project/user `lens-studio` configuration, then `http://localhost:50040/mcp`.
Override it when Lens Studio chooses another port:

```bash
pnpm --filter @viro-external/specs specs:go -- \
  --project "/path/to/project" \
  --mcp-url "http://localhost:50041/mcp"
```

Credentials are never printed by the setup checks. If authentication fails,
refresh the Authorization header using Lens Studio's MCP server configuration.
If Codex ignores an untrusted project configuration, open Codex in that Lens
folder, trust the project, and rerun. Do not put tokens in command-line URLs.

## Run the finish prompt

```bash
pnpm --filter @viro-external/specs specs:go -- \
  --project "/absolute/path/to/MySpecsProject" \
  --exec
```

After preparation, this launches `codex exec` from the Lens project folder and
supplies the generated prompt through stdin. A complete build/verification pass
can take 30+ minutes.

The runner detects supported flags from `codex exec --help`. Current Codex uses
`--approve-for-me` for automatic approval review and `--skip-git-repo-check` for
Lens folders outside Git. An older CLI receives `--full-auto` only if it explicitly
advertises that flag. Unsupported capabilities produce an actionable error,
without silently adding unsupported flags or changing the global policy.

Use `--no-auto-review` to retain Codex's configured approval policy; the previous
`--no-full-auto` spelling remains an alias. A configured policy can require human
input or reject actions during the run. A zero exit status means the Codex process
completed; inspect its final report for the actual preview and regression results.

If the installed CLI lacks `codex plugin add`, install **ls-clad** from
**ls-extensions** through `/plugins`, then rerun, or update Codex.

## Runner regression tests

```bash
pnpm --filter @viro-external/specs specs:test-runner
```

Tests use temporary project folders, a local fixture MCP server and a mock Codex
executable. They cover repeated config merges, authentication, JSON/SSE
initialization, session cleanup, metadata preservation, supported CLI flags,
plugin installation and failure handling. They do not launch a real Codex task or
modify the live Lens project or user-wide configuration.
