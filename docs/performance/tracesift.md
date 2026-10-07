# TraceSift performance workflow

TraceSift is the default first-pass analyzer for JavaScript/Hermes and React render performance in viro-external integrations.

## Setup

Requires macOS or Linux and Node.js 22.19 or newer.

```sh
pnpm perf:tracesift:init
pnpm perf:tracesift
```

## Profile these paths

Use identical scenes and assets before/after a change:

- external-surface mount/unmount and lifecycle churn;
- Rive panel state changes and interaction;
- media surface creation, playback UI updates, and teardown;
- drag/resize/transform updates on premium panels;
- multi-panel scenes;
- React prop changes that fan out into Viro nodes;
- web/host fallback paths.

Use React Profiler exports for render/commit bottlenecks and Hermes/JS CPU profiles for JavaScript hot spots.

TraceSift does not profile native frame production, GPU composition, Metal/Vulkan, or OpenXR directly. If the handoff crosses the external-surface boundary, pair it with native/GPU tooling and preserve both sides of the evidence.

Do not commit raw captures by default. Add a concise finding and comparable before/after numbers to the PR instead.
