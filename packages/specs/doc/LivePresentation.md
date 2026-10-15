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
   clearing the previous view. Textures that only exist at runtime, such as
   remote CMS photos loaded with `RemoteMediaModule`, are added with
   `registry.registerImage(id, texture)` before presenting a node whose
   `source` is that id.
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

A `group` node can take `scroll: { width, height, contentHeight }`, in
meters, to show more content than fits on a card. The Lens runtime gives the
group a child SceneObject with a Spectacles UI Kit `ScrollWindow`, vertical
only, with a `width` x `height` window over a scroll area of `width` x
max(`height`, `contentHeight`), and starts it scrolled to the top.

Children of a scroll group use content coordinates: x = 0 is the window's
centre line, y = 0 is the top edge of the content, and y goes negative
downward. A row 4 cm tall sits at y = -0.02, the next at y = -0.06. The
runtime gets there by parenting children to a content anchor placed at
+contentHeight / 2 inside the ScrollWindow's scroller, because ScrollWindow
centres its content area on its own origin and shows the top at normalized
scroll position y = 1. The anchor goes in through `ScrollWindow.addObject`,
the same way UI Kit's own Dropdown builds its list, so it works whether or
not the ScrollWindow has initialized yet.

Pinch targets inside the content bind through the usual deferred bind. After
that bind the runtime rewrites each ScrollWindow's `scrollDimensions`, which
drops the collider cache ScrollWindow uses to switch child colliders off
outside the window. Bind actions to rows inside the content, not to the
scroll group: the group's subtree already holds the ScrollWindow's own
Interactable, and a second one on the group would compete with it for the
pinch (untested). Clearing the page destroys the group, and the ScrollWindow
and its Scroller go with it. Scrolling has not run in Preview or on hardware.

There is no scroll bar. UI Kit's `ScrollBar` takes its `scrollWindow` and
`orientation` as private Inspector inputs with no setters, and its start
handler reads `scrollWindow` straight away, so a ScrollBar created from
script has nothing to read. Adding one needs Inspector wiring or writes to
private fields, and this runtime does neither.

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
