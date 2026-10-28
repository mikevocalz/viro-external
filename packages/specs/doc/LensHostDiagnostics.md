# Lens host diagnostics (VS5xxx)

`ViroSpecsSceneController` never throws into Lens Studio. Every failure and
every approximation it makes is a `ViroSpecsHostDiagnostic` on the
`ViroSpecsHostDiagnostics` channel:

```ts
type ViroSpecsHostDiagnostic = {
  code: "VS5001" | ...;           // VIRO_SPECS_HOST_DIAGNOSTICS
  severity: "error" | "warning" | "info";
  phase: "validate" | "stage" | "commit" | "patch" | "assets" | "interaction" | "animation" | "dispose" | "listener";
  message: string;
  hint: string;
  nodeId?: string;
  fieldPath?: string;             // JSON Pointer into the scene document
  sceneRevision?: number;
};
```

`ViroSpecsSceneControllerHost` writes each one to the Lens log with
`formatViroSpecsHostDiagnostic` and keeps the last 64 in
`diagnostics.recent`. Subscribe with
`controller.diagnostics.addOnDiagnosticListener(listener)`; the returned
subscription's `remove()` is idempotent.

The `VS5xxx` range belongs to the Specs diagnostic catalog in
`mikevocalz/viro` (`components/Specs/core/diagnosticCodes.ts`, documented in
`docs/specs-diagnostics.md`), so codes from the compilers and from the Lens
never collide. The test suite checks this page against
`VIRO_SPECS_HOST_DIAGNOSTICS`.

| Severity | Effect on the scene |
| --- | --- |
| `error` | The call changed nothing on screen. The committed scene stays. |
| `warning` | The scene rendered with the stated approximation or placeholder. |
| `info` | Nothing visible. |

## Codes

### VS5001 · error

Unsupported scene protocol. The input's `version` is not 1 or 2. Recompile
with a `viro-specs-compile` that matches this `@viro-external/specs`.

### VS5002 · error

Scene failed host validation. One diagnostic per problem, each with a
`fieldPath`. Raw JSON from a transport gets the same checks as compiled
output, so a payload that skipped the compiler cannot clear the live scene.

### VS5003 · warning

Asset is not registered; placeholder shown. An image or model `source` has no
entry in `ViroSpecsAssetRegistry`, or its async load failed. The node shows a
bounded tinted box (the node's extents, or 0.2 m square) and the rest of the
scene runs normally. Lifecycle becomes `degraded`.

### VS5004 · warning

Material is not registered; default material used. A `materialId` names
neither an entry in the scene's `materials` nor a material in the registry,
or the backend had no base material to build an owned one from.

### VS5005 · error

Staging failed; previous scene kept. A Lens call threw while the new scene
was being built under its disabled root. The staging root and everything
under it were destroyed, owned materials released, and the committed scene
is untouched.

### VS5006 · info

Async work finished after its scene was retired. An asset load completed
after navigation, replacement or node removal. The result was discarded.

### VS5007 · warning

Font family is not registered; default font used. Register the font in
`ViroSpecsAssetRegistry` under `fontIds`/`fonts`.

### VS5008 · warning

maxLines is approximated by the text box height. Lens `Text` has no line
limit. The host sizes the box to `maxLines` lines at the resolved font size
and truncates vertical overflow. Give the node `extents` for exact layout.

### VS5009 · error

Listener or action handler threw. The exception was caught and the Lens keeps
running; other listeners still received the event.

### VS5010 · info

Resource cache is full; least recently used entry released. The owned
material cache keeps at most `maxCachedMaterials` idle entries (default 32).

### VS5011 · warning

Placeholder visual is unavailable. Set `placeholderMaterial` (or
`defaultImageMaterial`) on `ViroSpecsAssetRegistry`; without one a missing
asset leaves an empty node.

### VS5012 · warning

Material lightingModel is not mapped. Lens shading comes from the base
material, not from `lightingModel`. Register a Lens material under the
material ID to control shading.

### VS5013 · warning

Patch op skipped. An explicit op named a missing node, changed `kind` or
`parentId` in an `update`, or would create a parent cycle. The other ops in
the patch applied.

### VS5014 · error

Backend operation failed. A Lens call threw while updating a committed node.
The node keeps its previous state for that field; the message names the
operation.

### VS5015 · error

Action is not declared. A trigger in the scene names an action ID that the
scene's `actions` list does not declare (the scene is rejected), or app code
dispatched an ID the `ViroSpecsActionRegistry` does not declare (the action
is dropped). See `ActionsAndState.md`.

### VS5016 · error

Action is declared or handled twice. Two entries in a scene's `actions` list
share an ID (the scene is rejected), or `ViroSpecsActionRegistry.on` was
called twice for one ID (the second handler is not registered).

### VS5017 · error

Action payload does not match its declaration. `fieldPath` names the field
that is missing, unknown, of the wrong type, not a whole number for an
`integer` field, or not in `enum`. In a scene this rejects the scene; at
dispatch the action is dropped and state is unchanged.

### VS5018 · info

Queued action invalidated by navigation. Triggered actions run one frame
after the pinch. If the scene that showed the node is retired first, the
action is dropped instead of running against the new scene.

### VS5019 · warning

Declared action has no handler. `ViroSpecsActionRuntime` received an action
the registry declares but no handler was registered for, and no `forward`
sink is set. State is unchanged.

### VS5020 · info

Route memory is full; least recently used route forgotten. The controller
remembers scroll positions for at most `maxRememberedRoutes` routes
(default 16). A forgotten route shows its scroll groups at their initial
position the next time it is presented.

## Experience layer

Codes from `ViroSpecsExperienceController` (`lens/ViroSpecsExperience.ts`),
phase `experience`. See `Experience.md`.

### VS5021 · info

Capability degraded; dependent UI hidden. Reported each time a capability the
scene uses changes to `unsupported`, `permission-required`,
`temporarily-unavailable` or `unverified`. The message names the capability,
the state and the UI that was hidden; the wearer sees the one-line notice from
the copy table.

### VS5022 · warning

Text raised to the 1.2 degree minimum. The host measured a text node at its
current distance and raised its size. PanelText sizes from tokens at compile
time, but placement and drag can move text farther away.

### VS5023 · warning

Position clamped into the 0.6-3.0 m comfort band. A placement or drag would
have put the node outside the band; it stops at the edge.

### VS5024 · info

Gaze-only input active. Hand tracking is not available, so the host selects by
gaze dwell (1000 ms, provisional) and adds step buttons for drag and scroll.

### VS5025 · warning

Premium component feature not drawn by this host. The scene document carries
a premium component feature that `ViroSpecsExperienceHost` does not render
yet (scroll-view native scrolling, model-viewer reset button and load ring,
image corner radius). Reported once per node; the message names the
features. See `Experience.md#not-drawn-yet`.
