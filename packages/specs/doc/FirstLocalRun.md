# First local run with Lens Studio already open

Lens Studio must be open **before** Codex is started so the terminal session can
auto-discover Lens Studio's MCP server.

## From the Lens project folder

Install Codex if needed:

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | bash
```

Start Codex:

```bash
codex
```

Inside Codex, add the Lens Studio extension marketplace:

```text
codex plugin marketplace add https://github.com/lens-studio-devs/ls-extensions.git
```

Open `/plugins` and install **ls-clad** from the `ls-extensions` marketplace.

Then run:

```text
/mcp
```

`lens-studio` should appear automatically.

Recommended approval configuration:

```bash
codex config set approval_policy "on-request" && codex config set approvals_reviewer "auto_review"
```

Then paste `VIRO_SPECS_CLAD_FINISH.md` into Codex.

## Why this cannot be driven from this ChatGPT web session

Lens Studio exposes its editor through a local MCP server. This ChatGPT session
does not currently expose that local MCP connection. Codex launched from the
open Lens project folder does, which is why the final preview loop must be
started there.
