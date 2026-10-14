# Live Specs presentations

The Lens host replaces one focused page at a time and retires the previous
scene's SIK targets first. It is a **Lens Studio
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
   Register a UI Kit frame as `defaultPanelPrefab`. For an image-backed
   scene, assign the texture's logical ID and `defaultImageMaterial` in
   `ViroSpecsAssetRegistry`; a missing asset/material is rejected before
   clearing the previous view.
5. In a Lens script, call `presentationHost.subscribeAction(handler)`
   and `presentationHost.present(payload)` after the runtime hosts initialize.
6. Run `specs:validate-lens`, `specs:test-presentation` (after build), CLAD
   Preview and LEAF selection/teardown tests.

The presentation host validates parents, targets, transforms, content fields
and registered assets before clearing the visible page, then retires previous
targets before creating the next set. A payload that fails during
`applyRenderPlan` after those checks still leaves the page empty; the caller
should catch the error and present a fallback page.

Action listeners run on the frame after the normalized `select-end` event, so
a listener can call `present()` without destroying an Interactable while SIK is
still dispatching to it. Every `select-end` on a bound target fires the action
again; debounce in the caller if a repeated pinch must not repeat the action.

Text nodes take an optional `textStyle: { size, color }`. `size` is in Lens
text points and `color` is linear RGBA from 0 to 1. Without it, text renders at
48 points in the font's default color, which is too small to read at arm's
length.

The host adds a `Component.Canvas` to each top-level node so UI Kit frames
draw behind the text and models that follow them, and binds action targets
one frame after the page is created. UI Kit frames build their mesh after
creation; binding in the same frame fits the collider to a text label, and
SIK then never reports a hit on it. A newer `present()` or `clear()` before
that frame cancels the bind.

Before retiring targets, the interaction runtime calls SIK's
`clearCurrentInteractable()` on every interactor still holding one of them,
the release SIK documents for deleting an Interactable at runtime. In a
6-replacement Preview run this cut SIK's "Object is null" cursor errors from
6 to 2; the remaining two come from the cursor's per-frame cache and SIK
catches them.

SIK fits the collider to the first visual under the bound node. Bind actions
to a panel-sized node, not a group whose only visual is a text label, or the
pinch target shrinks to the glyph bounds.

Node positions are local to the `ViroSpecsRuntimeHost` SceneObject. Placing
that object (world-locked, head-following, or re-placed per page) is the Lens
scene's job; this host does not move it.

None of this lifecycle behavior has run in CLAD Preview or on Specs hardware
yet. The tests below are source-level.

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
