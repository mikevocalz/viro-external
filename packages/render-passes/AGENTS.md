# @viro-external/render-passes — AGENTS

Read this before any work. House rules apply on top of the workspace root
CLAUDE.md.

## Scope

Multiplex layer for `VROChoreographer::setCustomPostOpaquePass`. This
package exists because that choreographer slot is **single** — see
`VROChoreographer.h:236` — and D.E.C.A. needs orb + splat + future
custom passes to coexist. Attaching a second pass directly to the
choreographer silently overwrites the first.

Scope explicitly does NOT include:

- The splat rendering pipeline — that's `@viro-external/splat-pass`.
- The orb rendering pipeline — that's `@viro-external/deca-orb-pass`
  (name provisional, package doesn't exist yet).
- Any change to virocore itself. The multiplex is a userland composition
  around the existing `VRORenderPass` interface. Do not fork
  `VROChoreographer` to hold a list.

## Decisions baked in

These are NOT to be re-litigated. See `doc/DECA-unified-render-pass-spec.md`
for the full grounding (file:line citations against `mikevocalz/virocore`
branch `v2.55.0-nitro-canvas`).

| Decision | Choice | Rationale |
|---|---|---|
| Insertion point | `VROChoreographer::setCustomPostOpaquePass` via a single owned `VROMultiplexRenderPass` | Only single-slot API in the choreographer. Per-eye, HDR target bound, depth filled — matches every consumer's needs. |
| Shared interface | Native `VRORenderPass::render(scene, outgoing, inputs, context, driver)` — already exists in virocore | Do not invent a new abstract base. Both orb and splat implement `VRORenderPass` today. |
| Multiplex ordering | Explicit `priority` int, ascending. Higher priority renders later (last writer wins on the HDR target before tone-map). | Matches `@viro-external/splat-pass`'s existing `priority` field. |
| Per-eye matrix source | `VRORenderContext::getViewMatrix/getProjectionMatrix/getEyeType/getFrame` | Splat-pass already depends on this contract. Do not recompute eye offsets anywhere. |
| GL state hygiene | Every child pass owns its own `GLStateScope` RAII. Multiplex does not save/restore for children. | Splat-pass owns its restore. Orb-pass will own its own. Nested restore is the wrong contract. |
| Sort / stereo machinery | NOT shared between children | Splat uses a CPU bucket-sort worker; orb is a small mesh with GPU depth-test. Forcing a shared sort pipeline is over-engineering. Stated explicitly in the spec §3. |

## API surface

```ts
import {
  registerRenderPass,
  unregisterRenderPass,
  useRenderPassStore,
} from '@viro-external/render-passes';
```

Provides the multiplex + registry. Individual pass kinds (`orb`, `splat`)
are attached through this registrar. `@viro-external/splat-pass`'s
`registerSplatPass` will delegate here in a follow-up PR — until then,
the splat registrar attaches directly to the choreographer (and orbits
cannot coexist with it yet).

## When debugging on device

The host app (`decax9`) lives at `/Users/mikevocalz/decax9`. Build with
`npm run android:pico` from that directory after dropping a fresh
`viro_renderer-release.aar` into `/Users/mikevocalz/viro/android/viro_renderer/`.

Logs filter on tag `Viro` (the renderer's `pinfo` macro). Multiplex
specific lines are prefixed `MultiplexPass:`.
