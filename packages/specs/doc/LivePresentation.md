# Live Specs presentations

The Lens host now supports replacing one focused page at a time without
preserving stale SIK targets from the previous scene. It is a **Lens Studio
host**, not a React/React Native runtime on the glasses.

## App-side protocol

Use `compileSpecsPresentation({ scene, targets })` from
`@viro-external/specs` before sending a JSON-safe payload. Nodes must have
unique IDs and be topologically ordered; target IDs must correspond to real
nodes. Actions are semantic strings such as `place:apollo-theater`, not
closures or direct database mutations. Scope each payload to one active user
session in the app transport.

## Lens Studio scene wiring

1. Target SPECS 27 / Lens Studio 5.22+ and install required pinned packages.
2. Sync `packages/specs/lens` into `Assets/ViroSpecs/lens`.
3. Attach `ViroSpecsAssetRegistry`, `ViroSpecsRuntimeHost`,
   `ViroSpecsInteractionHost`, and `ViroSpecsPresentationHost`.
4. Assign `runtimeHostObject` and `interactionHostObject` in the Inspector.
5. In a Lens script, call `presentationHost.subscribeAction(handler)`
   and `presentationHost.present(payload)` after the runtime hosts initialize.
6. Run `specs:validate-lens`, `specs:test-presentation` (after build), CLAD
   Preview and LEAF selection/teardown tests.

The presentation host performs validation before clearing the visible page;
it retires previous targets before creating the next set. Its callback fires on
the normalized `select-end` event exactly once per bound target. The caller
owns authorization and state transitions.

### Boundaries

This PR does **not** implement Mobile Kit, Supabase, live Payload fetching,
a generated React Native-to-Lens scene compiler, or physical Specs verification.
The older `codex/specs-generated-preview` branch has experimental JSX export
and Rive baking, but is heavily divergent from `main`. Recover those pieces in
separate audited changes; do not merge the entire branch.

Portable quaternions use **[x, y, z, w]** everywhere. Lens Studio's native
constructor receives reordered **(w, x, y, z)** values. The static regression
test checks this adapter wiring, but Preview/device transform verification
remains required.
