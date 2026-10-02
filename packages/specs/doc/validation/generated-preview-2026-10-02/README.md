# Generated-scene preview pass — October 2, 2026

Second Lens Studio Preview pass over the Viro SPECS runtime, this time driving a
compiler-shaped generated scene host instead of the hand-written
`ViroSpecsPlatformLab`. It covers the same runtime files PR #19 validated, plus
the lifecycle paths that only a restart/teardown cycle exercises.

Lens Studio 5.24.0.26090816, SPECS 27 Preview. Repository
`/Users/mikevocalz/viro-external-specs-preview`, branch
`codex/specs-generated-preview`, based on `16d59f5`. Node 26.8.2, pnpm 10.32.1,
TypeScript 7.0.2.

## What the generated host is

`Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts`, inside the saved Lens
project. It applies a static scene snapshot, enables interaction, plays a looping
native animation, and presents a VolumetricLine, then tears all four back down
through the host APIs:

| Host | Teardown call |
| --- | --- |
| `ViroSpecsInteractionHost` | `remove(nodeId)` |
| `ViroSpecsAnimationHost` | `stop(nodeId)` |
| `ViroSpecsNavigationHost` | `clearRoute()` |
| `ViroSpecsRuntimeHost` | `clear()` |

Those four methods are what this branch adds to the runtime. The scenarios in
`ViroSpecsLeafSceneSmokeScenario` and `ViroSpecsLeafInteractionScenario` switch
to the generated path when `generatedHost()` finds the component, and fall back
to the hand-written lab otherwise.

The host file is not in this repository. No checked-in tool emits it — see
"Unbacked artifacts" below.

## Reproducible from this repository

Run from the repository root. Every command below was run on the commit above.

```sh
pnpm --filter @viro-external/xr-contract typecheck   # exit 0
pnpm --filter @viro-external/specs typecheck         # exit 0
pnpm --filter @viro-external/specs... build          # exit 0
node -e "require('./packages/xr-platform-contract'); require('./packages/specs')"
pnpm --filter @viro-external/specs specs:validate-lens   # 19 files, no forbidden imports
pnpm --filter @viro-external/specs specs:test-runner     # 13/13 launcher tests
pnpm --filter @viro-external/specs specs:typecheck-lens -- \
  --project "$HOME/Documents/Lens Studio/Viro Specs Platform Lab"
```

`specs:typecheck-lens` is new on this branch. It compares all 19 files in
`packages/specs/lens` against the project copy byte for byte, then typechecks the
20 Viro sources (19 synced + the generated host) against the Lens Studio API
declarations the project writes to `Cache/`. It passed, and it fails on an
injected `const x: number = "s"` in any of those files, so the pass is not vacuous.

`package-resolution.json` reproduces exactly:

| Package | Version | CommonJS exports |
| --- | --- | --- |
| `@viro-external/specs` | 0.2.0-rc.1 | 23 |
| `@viro-external/xr-contract` | 0.2.0-rc.1 | 0 |

Zero is correct for the contract package. `src/index.ts` declares only types, so
`dist/index.js` carries the `__esModule` marker and nothing else.

## Preview run

Both LEAF scenarios pass in Lens Studio 5.24.0.26090816, SPECS 27 Preview, driving
the generated host:

```
PASSED: viro_specs_scene_smoke
PASSED: viro_specs_interaction
VIRO_GENERATED smoke PASS canonical-jsx=true reloadCycles=3 native-loop=true
```

The generated path is what ran, not the hand-written lab — `VIRO_GENERATED
animation-loop PASS`, `polyline PASS`, `interaction PASS` and `lifecycle PASS`
all appear for cycles 0, 1 and 2, and those only print from
`validateGeneratedScene`.

Measured across the three restart cycles: the looping title animation resets
twice per cycle with scale between 1.0001 and 1.1500 on a single clip; the
polyline renders its three control points at [-30,-20,-138], [0,2,-138],
[30,-8,-138] cm with radius 0.4 cm; the model drags from -20.05 cm to -5.10 cm
on X with Z held inside 1 cm, and the last portable drag event reports
-0.051 m, matching the final centimetre position; teardown leaves
`generatedChildren: 0`.

### One thing Preview cannot do

Surface-placement confirmation. `VIRO_GENERATED placement:live` reports
`PARTIAL`, not `PASS`:

```json
{"nativeConfirmation":false,
 "nativeConfirmationUnavailableReason":"SurfacePlacement Vertical requires |hit normal.y| > 0.0001; Preview's axis-aligned wall reports ~1e-7",
 "sessionStarted":true,"active":false,"detectorDisposed":true,"lateCallbacksAfterCancel":0}
```

`Vertical.onInteractionEnd` completes only when `hitTestSession != null &&
step2.enabled && isLookingAtCalibrationIcon()`, and `Vertical.updateCalibration`
enables step2 on `Math.abs(normal.y) < 0.15 && Math.abs(normal.y) > 0.0001`.
Preview's wall is exactly axis-aligned — the same run logs its hit normal as
`[0, -1.19e-7, 1]` — so |normal.y| falls under that lower bound and step2 never
enables. A real wall is never that exact. Starting a session, the pending pose,
cancel, detector disposal and the absence of late callbacks are all still
asserted; only the native confirmation is not claimed.

## Runtime fixes this pass produced

- `ViroSpecsSceneRuntime` built rotations as `new quat(x, y, z, w)`. Lens Studio's
  constructor is `quat(w, x, y, z)` — confirmed in `StudioLib.d.ts` — so every
  non-identity rotation in a render plan landed wrong. The portable boundary
  stays `[x, y, z, w]` on both sides, matching the pose serialization in
  `ViroSpecsWorldRuntime.startPlacement`.
- `ViroSpecsInteractionRuntime` never unsubscribed its SIK handlers and reused
  records whose `root` had been destroyed. It now keeps the `unsubscribe`
  functions SIK's `Event.add` returns and drops stale records.
- `ViroSpecsAnimationRuntime` leaked delayed starts and completion listeners
  across replays. `stop(nodeId)` cancels the pending `setTimeout`, removes the
  completion listener, and removes the clip from the player.
- `ViroSpecsNavigationRuntime` held a user-position subscription for the life of
  the Lens. `dispose()` releases it, wired to `OnDestroyEvent`.

## Unbacked artifacts

`bounce-result.json` and `moyo-result.json` record a compiler refusing to emit a
scene — an unsupported `Bounce` easing, and a native entry with no static
`ViroSpecsScene` root. Nothing in this repository prints those strings:

```sh
git log --all -S "Refusing to emit"      # no commits
grep -rl "Refusing to emit" .            # no files
```

The same search across `virocore`, `viro-external`, `moyo-rive-panel` and the
saved Lens project finds nothing either. Treat both files as a record of a tool
that is not in the tree, not as a gate that can be rerun. The compiler needs to
land before either result counts as evidence.

## Still hardware-only

Unchanged from [CLADValidationReport.md](../../CLADValidationReport.md). Preview
exercises no optics, sensor quality, outdoor GPS, radios, thermals, battery,
physical brightness, or on-device frame pacing, and this pass adds no claim about
any of them.
