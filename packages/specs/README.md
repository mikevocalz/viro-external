# @viro-external/specs

`@viro-external/specs` puts a Viro scene on Snap Spectacles ("Specs") through Lens Studio. You describe the scene once as portable XR nodes. The package compiles those nodes into a render plan, and a set of Lens Studio TypeScript components executes that plan as Lens `SceneObject`s, Text, Image, prefab instances and Spectacles UI Kit frames.

Two renderers consume the same description:

- **Native Viro (iOS, Android, Quest, PICO):** ViroCore renders the panel. ViroCore and any Eskiu-backed surface live on this side only.
- **Specs:** Lens Studio renders it. ViroCore does not run on the glasses, and nothing from Eskiu, React or React Native ships in the Lens. The Lens runtime in [`lens/`](./lens) is plain Lens Studio TypeScript, and `specs:validate-lens` fails the build if any file in it imports `@viro-external/*`, `react` or `react-native`.

Version `0.2.0-rc.1`. Targets SPECS 27, Lens Studio 5.22.0 or later. The release was validated in Lens Studio 5.24.0 Preview, not on hardware (see [Status](#status-and-what-is-not-validated)).

## Contents

- [Before you start: what is on `main`](#before-you-start-what-is-on-main)
- [How it fits together](#how-it-fits-together)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Authoring a scene](#authoring-a-scene)
- [Mapping table](#mapping-table)
- [Animation, interaction, world and navigation](#animation-interaction-world-and-navigation)
- [Runtime detection](#runtime-detection)
- [Scripts and CLI reference](#scripts-and-cli-reference)
- [Lens Studio project setup](#lens-studio-project-setup)
- [Three-slot workspace on Specs](#three-slot-workspace-on-specs)
- [Troubleshooting](#troubleshooting)
- [Status and what is not validated](#status-and-what-is-not-validated)
- [Package layout](#package-layout)
- [References](#references)

## Before you start: what is on `main`

The authoring input on `main` is an array of `PortableXRNode` objects from `@viro-external/xr-contract`. It is not JSX.

The following pieces are **not on `main`** and this README does not document them as working:

| Not on `main` | What you do instead today |
| --- | --- |
| A `toPortableScene` mapper from `@viro-external/ui` JSX (`SpatialPanel`, `PanelButton`, `SpatialScrollView`, ...) to portable nodes | Write `PortableXRNode[]` by hand, or build them from your own app state |
| A `specs:scene` script that writes `generated/ViroUIScene.ts` into a Lens project | Call `ViroSpecsRuntimeHost.applySceneSnapshot()` from a Lens script you own (the Platform Lab does this) |
| A generated scene host (`ViroGeneratedSceneHost.ts`) | Same as above |
| Native scroll for a variable-height panel stack on Specs | Not built anywhere. There is no `scroll` node kind in the contract |
| `worldSlot()` in `@viro-external/ui` | On `main` since PR #33. See [Three-slot workspace](#three-slot-workspace-on-specs) |

If you are on a branch that adds these, its own README takes precedence.

## How it fits together

```text
your app state
      |
PortableXRNode[]                    @viro-external/xr-contract
      |
compileSpecsScene()                 src/index.ts       validates, returns SpecsSceneSnapshot + diagnostics
compileSpecsRenderPlan()            src/render.ts      snapshot -> create/transform/content/visibility commands
      |
      |   JSON (wire version 1)
      v
ViroSpecsRuntimeHost                lens/              Lens Studio component
  .applySceneSnapshot(snapshot)       compileLensRenderPlan() (dependency-free copy of the compiler)
  .applyRenderPlan(plan)              ViroSpecsSceneRuntime executes commands
      |
SceneObject / Text / Image / ObjectPrefab / UI Kit prefab
```

`lens/ViroSpecsProtocol.ts` is a hand-kept structural copy of the shared types and compiler. Lens Studio cannot resolve npm workspace packages, so the Lens side cannot import `src/`. Keep the two in sync when you change the contract.

Moving the snapshot between processes is your job. `SpecsRuntimeTransport` defines the interface (`getCapabilities`, `applyScene`, `onInteraction`, `dispose`), and `lens/ViroSpecsLensTransport.ts` implements it inside the Lens. No transport from a phone or a server into the Lens ships in this package.

## Prerequisites

| Requirement | Version | Where it is checked |
| --- | --- | --- |
| Node.js | 22.13.0+ | root `package.json` `engines` |
| pnpm | 12.8.1 | root `packageManager` |
| Lens Studio | 5.22.0+ (validated on 5.24.0.26090816) | `specs:doctor` reads `studioVersion` from the `.esproj` |
| Lens project target | `Spectacles` | `specs:doctor` reads `targetPlatform` |
| Lens packages | see [step 3](#3-install-lens-packages) | `specs:doctor` warns if missing from `Packages/` |
| Codex CLI with plugin support | only for `specs:go` | `specs:go` probes `codex --version` and `codex plugin list --json` |

The upstream Snap package set is pinned to `specs-devs/packages` commit `df8820c0c4970f052e545b8da1dd288c2516d912` in [`upstream/specs-27.json`](./upstream/specs-27.json). [`doc/UpstreamIntegration.md`](./doc/UpstreamIntegration.md) covers the upgrade rules.

## Install

The package is not published to npm (`npm view @viro-external/specs` returns 404). Use it from the workspace:

```bash
git clone https://github.com/mikevocalz/viro-external.git
cd viro-external
pnpm install
pnpm --filter @viro-external/specs typecheck
```

From another package in the workspace:

```json
{
  "dependencies": {
    "@viro-external/specs": "workspace:*",
    "@viro-external/xr-contract": "workspace:*"
  }
}
```

`@viro-external/xr-contract` is a peer dependency (`^0.2.0`). `pnpm --filter @viro-external/specs build` emits ESM to `dist/` and CommonJS to `dist/cjs/`. The export map sends `import` to ESM, `require` to CommonJS, and the `react-native` condition (Metro) to `src/index.ts`. The package's `types` entry points at `src/index.ts`.

## Authoring a scene

A scene is a flat array of nodes. Parents must come **before** their children, because the Lens runtime creates nodes in array order and looks up the parent when it creates a child.

```ts
import { compileSpecsScene, compileSpecsRenderPlan } from "@viro-external/specs";
import type { PortableXRNode } from "@viro-external/xr-contract";

const nodes: PortableXRNode[] = [
  { id: "root", kind: "group", position: [0, 0, -1.5] },              // meters
  { id: "card", parentId: "root", kind: "panel", scale: [3, 5, 1] },
  { id: "title", parentId: "root", kind: "text", text: "Solve for x", position: [0, 0.22, 0.01] },
  { id: "tutor", parentId: "root", kind: "model", source: "models/tutor", position: [-0.22, -0.04, 0] },
  { id: "hint", parentId: "root", kind: "image", source: "images/hint", visible: false },
];

const { scene, diagnostics } = compileSpecsScene(nodes);
if (diagnostics.some((d) => d.level === "error")) {
  throw new Error(diagnostics.map((d) => `${d.nodeId}: ${d.message}`).join("\n"));
}

const payload = JSON.stringify(scene);          // send to the Lens
const plan = compileSpecsRenderPlan(scene.nodes); // or send the plan directly
```

Inside the Lens, any script holding a `ViroSpecsRuntimeHost` reference calls `runtimeHost.applySceneSnapshot(JSON.parse(payload))`.

`SpecsAdapter` wraps the same path for code written against `XRPlatformAdapter`. `updatePortableScene(nodes)` compiles and throws on any error diagnostic, then calls `transport.applyScene()`.

### Node fields

| Field | Type | Effect on Specs |
| --- | --- | --- |
| `id` | `string` | Becomes the SceneObject name `viro:<id>`. Must be unique |
| `kind` | `"group" \| "text" \| "image" \| "model" \| "panel"` | Picks the Lens primitive (see [Mapping table](#mapping-table)) |
| `parentId` | `string?` | Parents the SceneObject. Omitted means the host's `root` input |
| `position` | `[x, y, z]` meters | Multiplied by 100 into Lens centimeters |
| `rotation` | 4-tuple | Portable Viro uses **[x, y, z, w]**; the Lens host reorders to its `quat(w, x, y, z)` constructor |
| `scale` | `[x, y, z]` | Applied as-is, with no unit conversion |
| `text` | `string?` | Sets `Text.text`. Throws on any node that is not `text` |
| `source` | `string?` | Logical asset ID resolved through `ViroSpecsAssetRegistry`. Valid on `image` and `model` only |
| `textStyle` | `{ size?, color? }` | Text points and linear RGBA 0..1. Valid on `text` only |
| `scroll` | `{ width, height, contentHeight }` meters | Valid on `group` only. Puts the group's children in a vertical UI Kit `ScrollWindow` (see [Mapping table](#mapping-table)) |
| `visible` | `boolean?` | Sets `SceneObject.enabled` |

Use stable logical IDs for `source`, such as `models/tutor`, not file paths. Each renderer maps the ID to its own asset type.

## Mapping table

What each node kind becomes, and what the compilers and runtime reject. "Compile" means `compileSpecsScene` / `compileSpecsRenderPlan`. "Runtime" means `ViroSpecsSceneRuntime` inside Lens.

| Kind | Lens primitive | Upstream package recorded | Carries | Dropped or rejected |
| --- | --- | --- | --- | --- |
| `group` | empty `SceneObject` | `AccessComponents` | transform, visibility | `text` or `source`: runtime throws |
| `group` with `scroll` | `SceneObject` + child `viro-scroll:<id>` with a UI Kit `ScrollWindow`, vertical only. Window `width` x `height`, scroll area `width` x max(`height`, `contentHeight`), all x100 into cm, scrolled to the top. Children attach to a content anchor added with `ScrollWindow.addObject` | `AccessComponents` | transform, visibility, `scroll` | `scroll` on any other kind, non-finite values, `width`/`height` outside (0, 10] or `contentHeight` < 0: `compileSpecsPresentation` and the Lens presentation host throw |
| `text` | `Component.Text`: size 48, centered, overflow, depth test on, registry `defaultFont` if set | none | transform, `text`, visibility | `source`: runtime throws |
| `image` | `Component.Image` | none | transform, `source` to `mainPass.baseTex`, visibility | Runtime throws if the ID is unregistered or the Image has no material |
| `model` | `SceneObject` + instantiated `ObjectPrefab` | `Instantiation` | transform, `source`, visibility | Missing `source`: compile **error**. Unregistered ID: runtime throws |
| `panel` | `SceneObject` + registry `defaultPanelPrefab` (a UI Kit frame) | `SpecsInteractionKitExamples` | transform, visibility | No `defaultPanelPrefab`: empty, invisible SceneObject, with no warning. `source`: runtime throws |
| any other kind (untyped JSON) | none | none | none | `compileSpecsScene`: **error**, node removed |

Diagnostics across all kinds:

| Condition | Level | Behaviour |
| --- | --- | --- |
| Duplicate `id` | error | Second node removed. `SpecsAdapter` and the Lens runtime refuse the scene |
| `parentId` not in the scene | warning | Compile passes. **The Lens runtime then throws** `Specs render node does not exist` when it creates the child, so treat this warning as fatal |
| Child listed before its parent | none | Not checked at compile time. Lens runtime throws for the same reason |

Not in the portable contract, so not serialized: portals, physics bodies, custom render passes, native texture handles, spatial audio graphs, video surfaces, horizontal scrolling, scroll bars, materials per node, text styling beyond `textStyle`. [`doc/Architecture.md`](./doc/Architecture.md) says to report these, never replace them with a flat image or screenshot.

### `@viro-external/ui` components

None of the `@viro-external/ui` exports compile to Specs on `main`. `SpatialPanel`, `PanelHeader`, `PanelButton`, `SpatialScrollView`, `PanelText`, `PanelImage`, `VideoPlayerPanel`, `SpatialVideoPlayerPanel` and `MuxSpatialPlayerPanel` all render through `@reactvision/react-viro` only. To show the same content on Specs today, build the equivalent `panel` / `text` / `image` nodes yourself.

## Animation, interaction, world and navigation

Each capability has a pure compiler in `src/` and a Lens host component in `lens/`.

| Capability | Shared API (`src/`) | Lens component | Upstream packages |
| --- | --- | --- | --- |
| Viro-style animation | `compileViroAnimationForSpecs({ properties, durationMs, delayMs?, easing?, loop?, completionEvent? })` | `ViroSpecsAnimationHost` | `AnimationExamples` |
| Hover, select, drag | `normalizeSpecsInteraction(raw)`, `SpecsInteractionRuntime` | `ViroSpecsInteractionHost` (`subscribe`, `setInteractable`, `setManipulationEnabled`) | `SpectaclesInteractionKit`, `InteractableHelper` |
| Surface hit test and placement | `normalizeSpecsWorldQueryHit(hit)`, `SpecsWorldRuntime` | `ViroSpecsWorldRuntime` (a plain class, not a component; on `main` only the LEAF validation code constructs it) | `WorldQueryHit`, `SurfacePlacement` |
| GPS route | `compileSpecsNavigationPlan(route, line?)` | `ViroSpecsNavigationHost` | `SpecsNavigationKit`, `VolumetricLine` |
| World polyline (ViroPolyline) | `compileSpecsPolyline({ points, widthMeters, materialId? })` | `ViroSpecsNavigationHost.presentPolyline` | `VolumetricLine` |

Animation properties are `positionX/Y/Z`, `scaleX/Y/Z`, `rotateX/Y/Z` and `opacity`. Each one animates from the node's current value to the target, as `ViroAnimations` does. Easing is `linear`, `ease-in`, `ease-out`, `ease-in-out` or `{ cubicBezier: [a, b, c, d] }`. The compilers throw on non-finite values, a negative duration or delay, an empty property set, routes with fewer than two points, out-of-range latitude or longitude, and non-positive line widths.

Interaction phases are `hover-enter`, `hover-move`, `hover-exit`, `select-start`, `select-end`, `drag` and `cancel`. Sources are `gaze`, `hand`, `pinch` and `voice`. [`doc/ARInteractionParity.md`](./doc/ARInteractionParity.md), [`doc/LensAnimationRuntime.md`](./doc/LensAnimationRuntime.md), [`doc/LensInteractionWorldRuntime.md`](./doc/LensInteractionWorldRuntime.md) and [`doc/LensNavigationPlatformLab.md`](./doc/LensNavigationPlatformLab.md) have the details.

## Runtime detection

```ts
import { isSpecsDevice, isSpecsEditor, isSpecsBuild, getSpecsRuntime, SpecsRuntime } from "@viro-external/specs";

getSpecsRuntime(); // { family, isDevice, isEditor, isBuild, isRuntime, internetAvailable }
```

`isSpecsDevice()` calls `global.deviceInfoSystem.isSpectacles()`. `isSpecsBuild()` is true on a device, or when `__VIRO_SPECS_BUILD__` is set; `ViroSpecsRuntimeHost.onAwake()` sets that marker. All functions return `false` outside Lens. `useSpecs()` is a plain function with no React dependency, named to match Expo Horizon's hook. See [`doc/RuntimeDetection.md`](./doc/RuntimeDetection.md).

## Scripts and CLI reference

Run every script from the repo root with `pnpm --filter @viro-external/specs <script>`. Put `--` before script flags.

| Script | Runs | Flags | What it does |
| --- | --- | --- | --- |
| `typecheck` | `tsc --noEmit` | none | Type-checks `src/`. Does not cover `lens/` (that needs Lens Studio globals) |
| `build` | `tsc -p tsconfig.build.json && tsc -p tsconfig.build.cjs.json` | none | Emits ESM to `dist/` and CommonJS to `dist/cjs/` |
| `specs:validate-lens` | `scripts/validate-lens-runtime.mjs` | none | Checks that 18 required `lens/*.ts` files exist, no Lens file imports `@viro-external/`, `react`, `react-native` or `../src/`, and every `./` import resolves |
| `specs:sync` | `scripts/sync-lens-runtime.mjs` | `--project <path>` (required), `--clean` | Copies `lens/` to `<project>/Assets/ViroSpecs/lens/` and writes `viro-specs.dependencies.json`. `--clean` deletes `Assets/ViroSpecs` first, **including Lens `.meta` files**, which gives the scripts new asset identities and breaks scene references |
| `specs:doctor` | `scripts/doctor-lens-project.mjs` | `--project <path>` (required) | Requires exactly one `.esproj`, `targetPlatform: Spectacles` and Lens Studio 5.22+ (errors, exit 1). Warns on missing packages and an unsynced runtime |
| `specs:bootstrap` | `scripts/bootstrap-platform-lab.mjs` | `--project <path>` (required) | Runs `specs:doctor`, then `specs:sync` without `--clean`, then writes `VIRO_SPECS_CLAD_FINISH.md` into the project |
| `specs:go` | `scripts/go-clad.mjs` | `--project <path>` (required), `--mcp-url <url>`, `--exec`, `--no-auto-review` (alias `--no-full-auto`) | Runs the doctor, probes the Lens Studio MCP server with an authenticated `initialize`, merges the endpoint into `<project>/.codex/config.toml`, installs the `ls-clad@ls-extensions` Codex plugin if absent, then runs `specs:bootstrap`. `--exec` also pipes the finish prompt into `codex exec` |
| `specs:test-runner` | `node --test scripts/go-clad.test.mjs` | none | 13 tests for `specs:go` against a fixture MCP server and a mock Codex binary |
| `prepack` | build + checks | none | Builds `xr-contract` and this package, `require`s `dist/cjs/index.js`, `import`s `dist/index.js`, then runs `specs:validate-lens`, `specs:test-runner` and `scripts/viro-bundle.test.mjs` |

`specs:go` picks the MCP endpoint in this order: `--mcp-url`, `VIRO_SPECS_MCP_URL`, the `lens-studio` server in project or user Codex config, then `http://localhost:50040/mcp`. It never prints credentials. [`doc/OneCommandCLAD.md`](./doc/OneCommandCLAD.md) is the full reference.

## Lens Studio project setup

### 1. Create the project

In Lens Studio 5.22 or later (5.24 is the validated version), create a project that targets **Spectacles**. Save it to a permanent folder; the scripts need a real path.

### 2. Check it

```bash
pnpm --filter @viro-external/specs specs:doctor -- --project "/abs/path/MySpecsLens"
```

### 3. Install Lens packages

Install through the Asset Library so they land in `Packages/`. The versions below are the ones recorded in the 2026-10-02 validation run.

| Package | Needed for | Validated version |
| --- | --- | --- |
| `SpectaclesInteractionKit.lspkg` | interaction | 2.0.0 |
| `SpectaclesUIKit.lspkg` | panel prefab | 2.0.0 |
| `SurfacePlacement.lspkg` | placement | 2.0.0 |
| `VolumetricLine.lspkg` | routes and polylines | 2.0.0 |
| `SpecsNavigationKit.lspkg` | GPS routes | 2.0.0 |
| `Leaf.lspkg` | Preview regression scenarios (editor only) | 2.0.2 |
| `AiPreviewAgentInspect.lspkg` | Preview inspection (editor only) | 2.0.2 |
| `AiPreviewAgentInteract.lspkg` | Preview synthetic input (editor only) | 2.0.1 |

`specs:sync` copies all 19 files in `lens/`, and between them they import from all eight packages above. The LEAF and AiPreviewAgent packages only do work in the editor, but the Lens still fails to compile without them. Install all eight before you sync.

### 4. Sync the runtime

```bash
pnpm --filter @viro-external/specs specs:validate-lens
pnpm --filter @viro-external/specs specs:sync -- --project "/abs/path/MySpecsLens"
```

Use `--clean` only for a first install or a project you are willing to rewire.

### 5. Wire the scene

In the Scene Hierarchy, create an object (the validated project calls it `ViroSpecsRuntime`) and add:

1. `ViroSpecsAssetRegistry`. Fill `modelIds` with `modelPrefabs` and `imageIds` with `imageTextures` as parallel arrays, so index *n* of the IDs maps to index *n* of the assets. Set `defaultPanelPrefab` to a UI Kit frame or BackPlate prefab, and `defaultFont` if you want one.
2. `ViroSpecsRuntimeHost`. Set `assetRegistryObject` to the object holding the registry. `root` is optional and defaults to the host's own SceneObject.
3. `ViroSpecsInteractionHost` if you need input. Set `runtimeHostObject`.
4. `ViroSpecsAnimationHost` if you need animation. Set `runtimeHostObject`.
5. `ViroSpecsNavigationHost` if you need routes or polylines. Set `navigationObject`, `assetRegistryObject`, `defaultLineMaterial` and `routeIcon`.
6. Your own script that holds the runtime host and calls `applySceneSnapshot(...)` once the scene is ready, for example in `OnStartEvent`.

For a working reference, add `ViroSpecsPlatformLab` (inputs `runtimeHostObject`, `interactionHostObject`, `modelSourceId`) and register a prefab under the ID `platform-lab-model`. It builds a root, panel, title, model, Select button and status line, and updates the status text on `button:selected` and `model:drag`.

### 6. Preview and Preview regressions

Press Preview and pick a SPECS 27 Interactive Preview room. To run the stored regressions, add `ViroSpecsAgentValidation` and `ViroSpecsLeafIndex`. The index registers two LEAF scenarios, `viro_specs_scene_smoke` and `viro_specs_interaction`.

To have Codex drive steps 3 to 6 against a running Lens Studio through its MCP server, use `specs:go` instead. [`doc/FirstLocalRun.md`](./doc/FirstLocalRun.md) and [`doc/CLADFinishPrompt.md`](./doc/CLADFinishPrompt.md) cover that path.

### 7. Device

Push to Spectacles from Lens Studio. This package contains no scripts or evidence for that step.

## Three-slot workspace on Specs

The three-slot layout places panels left, center and right on an arc around a settled head pose. `worldSlot(slot, headPosition, headYawDeg, options?)` is the Viro-side function that computes it. It ships from `@viro-external/ui` (merged in PR #33).

In that branch it returns a `WorldSlotPlacement`:

| Field | Units | Notes |
| --- | --- | --- |
| `placement.position` | meters, `[x, y, z]` | Default distance 2.6 m, side angle 28° |
| `placement.rotation` | **Euler degrees** `[0, yawDeg, 0]` | Faces the panel's +Z normal back at the head |
| `placement.distanceM`, `placement.bearingDeg` | m, degrees | Informational |

`position` goes straight into a portable node. `rotation` does not. The portable field is a quaternion in `[x, y, z, w]` order; the Lens runtime reorders it for `quat(w, x, y, z)`. Convert the yaw first:

```ts
import type { PortableXRNode } from "@viro-external/xr-contract";

// Yaw about +Y, in the portable [x, y, z, w] order.
function yawToSpecsRotation(yawDeg: number): [number, number, number, number] {
  const half = (yawDeg * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

const head: [number, number, number] = [0, 1.6, 0];
const nodes: PortableXRNode[] = (["left", "center", "right"] as const).map((slot) => {
  const placement = worldSlot(slot, head, headYawDeg);
  return {
    id: `slot-${slot}`,
    kind: "panel",
    position: placement.position,
    rotation: yawToSpecsRotation(placement.rotation[1]),
  };
});
```

Put each panel's content under its `slot-*` node with `parentId`, so the content moves with its carrier. On Specs the head pose comes from the Lens camera, not from Viro. Your Lens script has to read it and supply `head` and `headYawDeg`; nothing in this package does that yet.

The yaw sign follows Viro (counter-clockwise about +Y, so the user's left is positive). No test or Preview run in this repo has checked this conversion on Lens. Verify one slot in Preview before you rely on it.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Specs render node does not exist: <id>` | A child references a missing parent, or appears before its parent in the array | Order parents first. Treat the "Parent ... is not present" warning as an error |
| `Specs render plan contains errors: ...` | The plan had error diagnostics (duplicate id, model without `source`) | Fix the nodes. The runtime refuses the whole plan |
| `Specs model asset is not registered: <id>` / `Specs image asset is not registered: <id>` | ID missing from the registry, or the ID and asset arrays are misaligned | Put the ID and the asset at the same index |
| `Specs Image node requires an Image material before setting source` | Lens creates `Component.Image` without a material | Give the Image a material, or use a `model` prefab for that content |
| `Text content supplied to non-text Specs node` / `Source content is unsupported for Specs primitive` | `text` on a non-text node, or `source` on `group` / `panel` | Move the field to a `text`, `image` or `model` child |
| Panel is invisible | `defaultPanelPrefab` not set, so `panel` is an empty SceneObject | Assign a UI Kit frame prefab in the registry |
| Panels face the wrong way or tilt | Rotation written as `[w, x, y, z]` or as Euler angles | Write `[x, y, z, w]`. See [Three-slot workspace](#three-slot-workspace-on-specs) |
| Content 100× too large or too small | Mixed units | `position` is meters (converted to cm). `scale` is not converted |
| Lens compile errors in `Assets/ViroSpecs/lens` naming an `.lspkg` path | One of the eight packages is missing, including the editor-only LEAF and AiPreviewAgent ones | Install every package in [step 3](#3-install-lens-packages) and recompile |
| Scene references to `ViroSpecs*` scripts are lost after a resync | `specs:sync --clean` deleted the `.meta` files | Resync without `--clean`. `specs:bootstrap` and `specs:go` never pass it |
| `specs:doctor`: `Expected exactly one .esproj file` | Pointed at the wrong folder, or a backup `.esproj` sits next to the real one | Pass the folder that contains the single `.esproj` |
| `specs:doctor` warns `SpectaclesUIKit.lspkg` missing but `viro-specs.dependencies.json` does not list it | The two scripts keep different lists. The doctor's list is the correct one | Install UI Kit |
| `specs:go`: `initialize could not connect` / `HTTP 401` | Lens Studio or its MCP server is not running, the port changed, or the token is stale | Start the MCP server in Lens Studio, pass `--mcp-url`, refresh the Authorization header in Codex config |
| `specs:go`: `Codex did not load lens-studio for this project` | Codex has not trusted the project's `.codex/config.toml` | Open Codex in the Lens folder, trust it, rerun |
| Preview input stops working after a LEAF run (`HostFunction Object is null`) | Seen during validation. Cause unproven | Refresh Preview, hover once before pinching |

## Status and what is not validated

Lens Studio Preview is a desktop simulator. Nothing below implies a run on physical Spectacles, and **this repo contains no evidence of a physical Specs run.**

Validated on 2026-10-02 in Lens Studio 5.24.0.26090816 Preview (SPECS 27 Interactive Preview, Sunlit Room). Evidence is in [`doc/CLADValidationReport.md`](./doc/CLADValidationReport.md) and [`doc/validation/2026-10-02/`](./doc/validation/2026-10-02/README.md):

- the Platform Lab scene compiles and renders (root at Z = -150 cm from -1.5 m);
- both LEAF scenarios pass, and a deliberately wrong assertion fails;
- SIK hover, pinch-select and drag change state through simulated hands;
- AnimationPlayer playback, a live WorldQuery hit, placement start and cancel, and a three-point polyline;
- graceful failure when Preview has no GPS fix.

Checked in this repo by scripts on every run: `typecheck`, `specs:validate-lens` (static import rules only, no Lens compile) and `specs:test-runner` (mock Codex, fixture MCP).

Not validated:

- **Any physical Spectacles run:** optics, readability, hand tracking, depth and semantic surfaces, outdoor GPS, networking, thermals, battery, frame pacing, memory, multi-device co-location.
- **Performance:** the recorded Preview traces are per-section editor timings, not device FPS.
- **JSX to Specs:** no mapper, generator or generated host exists on `main` (see [Before you start](#before-you-start-what-is-on-main)).
- **Scrolling:** no portable scroll node, and no native scroll for variable-height panel stacks.
- **Yaw-to-quaternion conversion** in the three-slot example: written from the code, not run.
- **`lens/` type safety outside Lens Studio:** `typecheck` does not cover these files. They are checked only when Lens Studio compiles them.
- **Contract drift:** nothing tests that `lens/ViroSpecsProtocol.ts` still matches `src/`.
- **A transport into the Lens:** `SpecsRuntimeTransport` is an interface. No phone-to-Lens or server-to-Lens channel ships.
- **Semantic surface labels:** Sunlit Room returned an unknown label. Classification mapping has controlled tests only.
- **Real GPS routes:** Preview has no fix.

## Package layout

```text
src/                 shared TypeScript (Node, React Native, anything with a JS runtime)
  index.ts           compileSpecsScene, SpecsAdapter, SpecsRuntimeTransport
  render.ts          compileSpecsRenderPlan
  animation.ts       compileViroAnimationForSpecs
  interaction.ts     normalizeSpecsInteraction
  ar.ts              normalizeSpecsWorldQueryHit, placement types
  navigation.ts      compileSpecsNavigationPlan, compileSpecsPolyline
  runtime.ts         isSpecsDevice, getSpecsRuntime, useSpecs, SpecsRuntime
  upstream.ts        SPECS_UPSTREAM_PACKAGES, getRequiredSpecsUpstreamPackages
  testing.ts         SPECS_PLATFORM_LAB_PLAN, runSpecsValidationPlan
lens/                Lens Studio TypeScript, copied into the Lens project by specs:sync
scripts/             the CLI scripts in the table above
upstream/            specs-27.json, the pinned specs-devs/packages manifest
doc/                 design notes, workflow guides and validation evidence
```

## References

Repository and in-repo docs:

- Repository: https://github.com/mikevocalz/viro-external
- Ownership and the unsupported-feature rule: [`doc/Architecture.md`](./doc/Architecture.md)
- Compatibility matrix: [`doc/Compatibility.md`](./doc/Compatibility.md)
- Build workflow: [`doc/LensBuildWorkflow.md`](./doc/LensBuildWorkflow.md)
- Lens Studio 5.24.1 Preview to Spectacles runbook, with known traps: [`doc/LensStudioRunbook.md`](./doc/LensStudioRunbook.md)
- Developer guide for building your own Lens UI, with code: [`doc/BuildingSpecsApps.md`](./doc/BuildingSpecsApps.md). Runnable sample: [`examples/specs-sample/`](./examples/specs-sample/README.md)
- Preview validation without a device: [`doc/NoDeviceValidation.md`](./doc/NoDeviceValidation.md)

Snap:

- Spectacles documentation: https://developers.snap.com/spectacles/home
- Introduction to Spectacles: https://developers.snap.com/spectacles/get-started/introduction
- Spectacles Interaction Kit, getting started: https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/get-started
- Spectacles UI Kit, getting started: https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-ui-kit/get-started
- Lens Scripting API: https://developers.snap.com/lens-studio/api/lens-scripting/index.html
- `quat` (constructor order `w, x, y, z`): https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.quat.html
- Lens Studio download: https://ar.snap.com/download
- Pinned upstream packages: https://github.com/specs-devs/packages
- Lens Studio agent extensions (`ls-clad`): https://github.com/lens-studio-devs/ls-extensions
