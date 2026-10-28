# ADR 0002: Incremental, transactional scene apply in the Specs Lens host

**Status:** Proposed (branch `feat/specs-host`, awaiting review)
**Date:** 2026-10-28
**Deciders:** Mike Allen
**Related:** viro ADR-0001 (manifest v2) and ADR-0002 (diagnostics format), viro `feat/specs-host`

## Context

### What the Lens host did at `c819554e`

- `ViroSpecsSceneRuntime.apply(plan)` executed create/transform/content/visibility
  commands against live SceneObjects and threw on any error
  (`lens/ViroSpecsSceneRuntime.ts:36-47`). `createNode` on an existing ID
  destroyed and recreated it (`:118-120`). There was no diff: every update was
  a full rebuild.
- `ViroSpecsPresentationHost.present` validated, then called
  `renderer.clear()` and only then built the new page
  (`lens/ViroSpecsPresentationHost.ts:128-133`). A failure after the clear
  left the page empty and rethrew. Selected actions were delivered on the next
  frame with no check that the page still existed (`:163-169`).
- `ViroSpecsRuntimeHost.applySceneSnapshot` checked duplicate IDs and model
  sources only (`lens/ViroSpecsProtocol.ts:248-323`): no version, kind or field
  checks on raw wire JSON.
- Delayed animations used SIK `setTimeout` with no cancel
  (`lens/ViroSpecsAnimationRuntime.ts:79-83`); the animation host had no
  `stop`, and the interaction host had no `remove`, although the generated
  host in viro called both.
- SIK forwarded four phases (`hover-enter`, `hover-exit`, `select-start`,
  `select-end`) plus drag; `hover-move` and `cancel` never fired, and
  `source` was a fixed `hand`/`pinch` (`lens/ViroSpecsInteractionRuntime.ts:139-150`).
- Text style, extents, maxLines, opacity, materials and lights never reached
  the Lens: protocol 1 cannot carry them, and viro reported each as `VS1015`.

### Forces

- The pack (§2, §3 WS3, §9) asks for: validate → stage invisible → commit →
  retire previous → dispose failed staging; create/update/remove/reparent
  ops; a state change touching one SceneObject; scroll, selection and focus
  kept for stable nodes; ownership so navigation invalidates queued actions,
  deferred SIK binding, delayed animations and async asset completions; owned
  vs borrowed resources with bounded caches; no throw inside the Lens.
- Lens runtime TypeScript cannot run in Node. Anything not testable outside
  Lens Studio stays `implemented` until a LEAF preview run.
- Two Asset Library lines exist (Interaction Kit 2.x and 4.0.0 under a new
  package name).

## Decision

1. **A Lens-global-free controller with a narrow backend.**
   `ViroSpecsSceneController<N, A, M>` (`lens/ViroSpecsSceneController.ts`)
   owns ordering, validation, ownership, resources and diagnostics. It drives
   a `ViroSpecsSceneBackend` (`lens/ViroSpecsSceneBackend.ts`) whose methods
   are single drawing operations (`createNode`, `setTransform`, `setText`,
   `setMaterial`, `showPlaceholder`, `bindInteraction`, ...). The Lens backend
   is `ViroSpecsLensSceneBackend`; tests use a recording mock. The controller,
   document reader, diagnostics and cache compile with `lib: ES2021` and no
   Lens types (`tsconfig.lens-core.json`), so Node runs the same code the Lens
   runs.
2. **Two entry points with different contracts.** `present(input)` is
   navigation and is transactional: read and validate, build every node under
   a new root created disabled, carry UI state of stable IDs, enable the new
   root, then retire the old scene (SIK bindings first, then async work, then
   SceneObjects, then owned materials). Any backend throw while staging
   destroys the staging root and reports `VS5005`; the committed scene is
   untouched. `update(input)` and `applyPatch(ops)` are state changes on the
   committed scene: the next document is validated in full, then
   `diffViroSpecsScenes` produces removes, creates, reparents and updates, and
   each update sends only the fields that changed.
3. **Ops are applied in a fixed order.** Survivors of a removed parent are
   moved to the scene root first, then removes (subtree roots only), creates
   (parents first), reparents, updates. A kind change is a remove plus a
   create. A failure in one op is `VS5014` for that node; the rest apply.
   Explicit ops that name missing nodes, change kind or parent in an update,
   or create a cycle are skipped with `VS5013`.
4. **Ownership is a token per scene.** Every scheduled job (deferred SIK bind,
   queued action, animation delay) and every async asset load registers a
   cancel with the scene's `Ownership`. Retiring the scene cancels them all.
   One-shot jobs release their entry when they run, so `pendingWork` counts
   only live work. A late asset completion is checked against the scene, the
   node record and a load token, and is discarded with `VS5006`.
5. **Protocol 2 on the wire, protocol 1 still read.** The controller reads
   `{ version: 2, nodes, polylines, lights, materials, interactions,
   animations }`, the manifest v2 document minus authoring metadata, and still
   reads protocol 1 snapshots (text `textStyle` and group `scroll` included).
   Anything else is `VS5001`. viro's `toSpecsSceneDocument` builds protocol 2;
   the generated host and `--format scene-json` use it, so `VS1015` is now
   reported only when a transport has only `applyScene`.
6. **Resources.** Registry materials and assets are borrowed and never
   disposed. Materials built from scene `materials` entries are owned, shared
   by definition through a reference-counted cache keyed by the definition's
   JSON, held per scene, and evicted least-recently-used beyond
   `maxCachedMaterials` idle entries (`VS5010`). Per-node clones (image
   materials, faded model materials, placeholders) live and die with their
   node. `dispose()` is idempotent and disposes each owned material once.
7. **Assets.** Registry lookups are synchronous today; the backend contract
   also accepts a promise so remote textures can load later. A missing or
   failed asset shows a bounded tinted box (`VS5003`, lifecycle `degraded`).
   Animations start only when no asset is pending.
8. **Interaction.** `bindViroSpecsSik` forwards all seven phases from SIK
   (`onHoverUpdate` → `hover-move`, `onTriggerCanceled` and
   `onTriggerEndOutside` → `cancel`, manipulation or drag updates → `drag`)
   with `source` from the interactor's `inputType` and the hit normal and ray
   direction. Spectacles has no SIK gaze interactor, so `gaze` arrives through
   `dispatchInteraction`, which WS4's gaze fallback calls. Hover and select
   set focus and selection; both survive patches and carry across navigation
   for stable IDs.
9. **No throw.** Every backend call is guarded; listeners are isolated
   (`VS5009`). Diagnostics go to `ViroSpecsHostDiagnostics` and the Lens log.
10. **One Interaction Kit seam.** Only `lens/ViroSpecsInteractionKit.ts`
    imports the kit; `specs:sync` rewrites its package prefix for 4.0.0.

## Options considered

### A: Controller over a backend interface (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium: one generic controller, one Lens backend |
| Testability | High: 22 mock-host tests, a 100-cycle suite, the Platform Lab fixture |
| Lens risk | Backend code is typechecked against Lens 5.24 declarations only; preview pending |
| Migration | Generated hosts regenerate; legacy hosts keep working |

### B: Make `ViroSpecsSceneRuntime` diff in place

| Dimension | Assessment |
| --- | --- |
| Complexity | Low at first |
| Testability | Low: every line touches Lens globals, so nothing runs in Node |
| Transactions | Needs staging bolted onto a class built around one live map |

Rejected: the pack's acceptance criteria are about ordering and lifetimes,
which are exactly what this option cannot test outside Lens Studio.

### C: Always rebuild, but stage invisible

| Dimension | Assessment |
| --- | --- |
| Complexity | Low |
| Cost per state change | Every SceneObject recreated, SIK rebound, scroll and focus lost |

Rejected: fails "a state change touches one SceneObject" and "stable nodes
keep their state".

### D: Patch protocol on the wire (send ops instead of documents)

| Dimension | Assessment |
| --- | --- |
| Bandwidth | Lower for large scenes |
| Robustness | A dropped or reordered message corrupts the Lens scene |

Deferred: documents are idempotent and the diff is cheap at Platform Lab
size. `applyPatch` exists for app code inside the Lens; a wire patch format
can reuse its op types later.

## Trade-off analysis

Option A costs an indirection layer and a mock backend that has to stay
honest. In exchange the transactional and ownership rules run in CI on every
commit. The backend is deliberately dumb so the untested part (Lens calls) is
small and reviewable. Protocol 2 makes the wire larger than protocol 1, but
it is the manifest the compilers already produce, so there is no second
schema to keep in sync.

## Consequences

- Easier: adding a node field means a reader check, a backend setter and a
  diff entry; the mock suite covers ordering for free.
- Harder: two scene paths exist in the Lens (controller and the legacy
  runtime/presentation hosts) until apps move to the controller.
- Changed: the generated host has one input (`sceneHostObject`) instead of
  four; `specs:doctor` fails on missing required packages; the peer is
  `@viro-external/xr-contract ^0.3.0`.
- Revisit: Lens text size per Viro point (1 today, not validated); light
  orientation from `quat.lookAt`; image extents from the quad's local AABB;
  Interaction Kit 4.0.0 module paths; a wire patch format.

## Evidence

| Claim | Label | Where |
| --- | --- | --- |
| Transactional present, patch ops, ownership, resources, interaction routing | portable-test-passed | `pnpm --filter @viro-external/specs specs:test-host` |
| Lens backend and hosts compile against Lens Studio 5.24 declarations with no new errors | implemented (typechecked outside Lens Studio) | `tsc` over `Cache/TypeScript/lib/LensifyTS/Declarations` of the Platform Lab project, 31 pre-existing non-decorator errors in other files, 0 in new ones |
| Rendering in Lens preview, placeholder visuals, SIK phases on device | not verified | Lens lane runs LEAF on this branch |

## Action items

1. [x] Controller, backend contract, Lens backend, controller host component.
2. [x] Protocol 2 reader with protocol 1 compatibility.
3. [x] viro: `toSpecsSceneDocument`, protocol 2 generated host, `VS5xxx` catalog.
4. [ ] Lens lane: LEAF scenarios for render, patch, missing asset, retired-scene deferred action, all seven phases.
5. [ ] Move `ViroSpecsPresentationHost` onto the controller (keeps clear-then-build today, after full validation).
6. [ ] Preview-validate Interaction Kit 4.0.0 and record module paths.
