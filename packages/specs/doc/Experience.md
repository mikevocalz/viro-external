# Experience layer

What the wearer sees around a Specs scene: the loading ring, the one-line
notice when a capability is missing, the error panel when something fails,
the placement reticle, PanelButton states, gaze dwell and the comfort clamps.
Design sources are in viro: `docs/ux/spatial-tokens.md`, `docs/ux/copy.md`,
`docs/ux/accessibility.md` and `docs/ux/handoff/*.md`. The compile-time side
(comfort checks, labels, premium components) is viro `docs/specs-experience.md`.

Evidence: `portable-test-passed` (`scripts/experience.test.mjs`, run by
`specs:test-host`). The Lens adapter (`ViroSpecsExperienceLensView.ts`) is
`implemented` only: it has not been compiled in Lens Studio or run in Preview.

## Files

| File | Lens globals | What it does |
| --- | --- | --- |
| `lens/ViroSpecsExperienceTokens.ts` | no | Token types and defaults (mirror of viro `tokens.ts`), theme and component validation, angle helpers |
| `lens/ViroSpecsExperienceCopy.ts` | no | Copy table generated from viro `copy.ts` |
| `lens/ViroSpecsExperience.ts` | no | `ViroSpecsExperienceController`, `resolveViroSpecsButtonVisual`, `ViroSpecsButtonTracker`, `ViroSpecsGazeDwell`, scroll and move steps |
| `lens/ViroSpecsPlacement.ts` | no | `ViroSpecsPlacementSession`, `classifyViroSpecsSurface` |
| `lens/ViroSpecsExperienceLensView.ts` | yes | Draws an experience view with Lens Text and the scene controller's backend |

The four portable files are in `tsconfig.lens-core.json`, so Node tests run
the same code Lens Studio runs.

## Lifecycle

`ViroSpecsExperienceController.attach(controller)` follows the scene
controller's lifecycle, asset progress and diagnostics.

| Scene controller | Wearer sees |
| --- | --- |
| `loading` | Nothing for the first `motion.fast` (120 ms), so a cached scene does not flash. Then the loading panel: "Loading scene", a ring filling by `done/total` assets, "Loading {done} of {total}". After 2000 ms, "Still loading. Large models can take a moment." The scene and its interactables stay hidden. |
| `ready` | The scene. |
| `degraded` (asset missing) | The scene with a placeholder box, and the `error.asset` panel with Retry. |
| `error` (first scene rejected) | The `error.sceneNoFallback` panel. Close keeps it up; the wearer leaves with the system gesture. |
| rejected update after a ready scene | The last scene plus the `error.scene` panel with Close. |

The slow threshold is the pack's 2 s first-frame target; WS3 has not
measured first-frame time on device yet.

Reduced motion: the determinate ring grows without rotating; an unknown total
shows three dots that change opacity.

## Degraded (a capability is missing)

`setCapabilities(report)` takes the Lens capability report. Changes apply
without a restart.

| Capability | State | Hidden | Replacement |
| --- | --- | --- | --- |
| `world-query` / `surface-placement` | unsupported | reticle, tint, placement label | model 1.5 m in front (`placeInFront`) |
| same | temporarily-unavailable | nothing; searching continues | notice |
| `hand-tracking` / `pinch` | permission-required | pinch hints, drag | gaze dwell, Move and Scroll buttons, "Place here"; on a scene without a gaze path, the permission panel |
| same | temporarily-unavailable | same | same, back to hands when tracking returns |
| `drag-manipulation` | unsupported | drag | Move buttons, no notice |
| any | unverified | nothing | builder mode only |

One notice at a time; placement beats hand tracking. A dismissed notice does
not return for that capability this session. Each change is reported once as
`VS5021`; switching to gaze is `VS5024`.

## Errors

At most one panel, with exactly one action:

| Kind | Title | Action |
| --- | --- | --- |
| `asset` | "Model didn't load" or "{n} models didn't load" | Retry: returns the node IDs to reload |
| `scene` | "Scene couldn't open" | Close |
| `scene-no-fallback` | "Scene couldn't open" | Close (panel stays) |
| `transport` | "Lost connection to the app" | Got it |

Each panel lists `{code} ({nodeId})` lines, de-duplicated. Node errors wait
until the scene is visible.

## PanelButton

`resolveViroSpecsButtonVisual(label, authored, { hovered, pressed }, tokens)`
returns the fill, border, ring, depth, scale, label text, glyph and accessible
name for the seven states in viro `docs/ux/spatial-tokens.md#panelbutton`.
Selected carries a check glyph and error an error glyph, so color is never the
only cue. Disabled and loading accept nothing.

`ViroSpecsButtonTracker` turns host interaction events into hover and press:
the press commits on release inside the button, release elsewhere or `cancel`
drops it, the last select-start wins, and the press stays on its button when
hover moves. The hover hook (haptic/audio) fires once per hover-enter; the app
can turn it off.

## Gaze dwell

`ViroSpecsGazeDwell` selects a target after `input.gazeDwellMs` (1000 ms,
provisional; sources in viro `docs/specs-experience.md#gaze-dwell`). It fires
once until the gaze leaves, and never on disabled or loading buttons. The host
turns a dwell into `select-start` and `select-end` with source `gaze` through
`dispatchInteraction`, so the app sees an ordinary select.

## Placement

`ViroSpecsPlacementSession` takes WorldQuery hits (about 5 Hz on SPECS) and
pinches:

- **searching**: no reticle; "Look at a table or the floor".
- **aiming**: a 2 degree ring on the surface, tinted by class at 35%;
  "{Surface}. Pinch to place.". The first time, "Look away to cancel".
- **countdown**: no valid hit for up to 1.5 s; the ring drains. Under reduced
  motion it reads "Cancelling". A valid hit resets it.
- **confirmed**: `color.success` ring, "Placed".
- **cancelled**: "Placement cancelled"; `restart()` for Place again.

A valid hit is a classified surface 0.6-3.0 m away. WorldQuery on SPECS only
classifies ground, so `classifyViroSpecsSurface` derives the rest from the
normal and the height above a known floor:

| Class | Rule |
| --- | --- |
| floor | WorldQuery ground, or horizontal under 0.2 m above the floor |
| seat | horizontal, 0.3-0.6 m above the floor |
| table | horizontal, 0.6-1.2 m above the floor, or any horizontal surface before a floor is known |
| wall | normal within 0.3 of horizontal |
| ceiling | normal pointing down |
| unknown | slopes and other heights; no tint, no placement |

These thresholds are starting values, not measured.

## Comfort clamps

- `clampToComfortBand(nodeId, position)` stops placement and drag at 0.6 or
  3.0 m (`VS5023`).
- `minimumTextSize(nodeId, size, distance)` raises Lens Text to 1.2 degrees
  at its current distance (`VS5022`).

## Preferences

`setPreferences({ highContrast, reducedMotion })` applies on the next view.
Whether Snap OS exposes a system setting for either is unverified, so the app
sets them. High contrast swaps the surface to black, text to white, focus to
`#ffd25e`, doubles borders and adds 0.2 degrees to every type size; on an
additive display black may render transparent, so the white outline carries
it (verify on device). Reduced motion removes every scale change and rotation.

## Not drawn yet

`ViroSpecsExperienceHost` draws SpatialPanel (backing and title), PanelButton
(backing, label, glyph, hover scale and depth, error message) and PanelText
(token color, 1.2 degree minimum from the compiled size). It does not draw
these yet; each node that uses one is reported once as `VS5025`:

| Component | Not drawn |
| --- | --- |
| SpatialScrollView | native scrolling, `itemHeightMeters`, `initialIndex` (the controller keeps scroll state for `group` nodes with `scroll`, not for scroll-view panels) |
| ModelViewer | `autoRotate`, the Reset model button, the load ring at the model bounds |
| PanelImage | `radius.card` corners |

`unrenderedViroSpecsComponentFeatures` in `ViroSpecsExperience.ts` is the
list the host reports from; update it when a feature lands.

## Wearer-relative measurement

The adapter measures every comfort distance from the camera, not from where
the Lens started: WorldQuery hits and Move steps are converted to
head-relative meters before they reach the placement session and
`clampToComfortBand`, and converted back to world meters for listeners.
