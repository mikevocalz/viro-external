# @viro-external/specs

Adapter foundation for **Snap Specs / Spectacles**.

Snap's runtime is Lens Studio + Snap OS, so this package does not try to boot ViroCore on the glasses. It compiles a portable scene subset and defines the runtime bridge that a Lens Studio package implements.

It has three parts:

- `src/`: the portable scene compiler, runtime detection and render plan types.
- `lens/`: the Lens Studio runtime, TypeScript that runs inside the Lens project.
- `scripts/`: the build commands below, which compile `@viro-external/ui`
  scenes into a Lens project and bake Rive panels.

## Scripts

Run these from `packages/specs`, or from the workspace root with
`pnpm --filter @viro-external/specs <script> -- ...`. Paths given to
`--entry` resolve against the directory the script runs in.

| Script | Usage |
| --- | --- |
| `specs:scene` | `pnpm specs:scene -- --entry scene.tsx --project /path/to/LensProject [--parent nodeId]` |
| `specs:sync` | `pnpm specs:sync -- --project /absolute/path/to/LensStudioProject [--clean]` |
| `specs:typecheck-lens` | `pnpm specs:typecheck-lens -- --project /absolute/path/to/LensStudioProject` |
| `specs:validate-lens` | `pnpm specs:validate-lens` |
| `specs:bake-rive` | `pnpm specs:bake-rive -- --riv file.riv --out file.gif --clips "Name=Animation[:loop],..." [--width 640]` |
| `specs:bake-rive-native` | `pnpm specs:bake-rive-native -- --entry scene.tsx --out <app assets dir>` |
| `specs:test-runner` | `pnpm specs:test-runner` |

### specs:scene

Compiles a `@viro-external/ui` scene file for Specs
(`scripts/compile-ui-scene.mjs`).

- `--entry`: the scene file. Its default export is the JSX tree, or a
  function returning it. It may export `resolveSource(source, kind)` to map
  bundled assets to Lens registry ids, and `animations` (the ViroAnimations
  registrations it uses). The file is loaded in Node through Babel;
  native-only imports (`react-native`, `@reactvision/*`, `expo*`, ...) resolve
  to inert stubs, because the mapper reads elements and never renders them.
- `--project`: the Lens Studio project root.
- `--parent`: optional parent node id for the top-level elements.

It runs `toPortableScene` from `@viro-external/ui`, bakes every `RivePanel`
that has a `specs` block, prints the mapper's warnings, and writes
`Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts`. Only the file content
is written, so Lens keeps the script's `.meta` and the scene's reference to it.

### specs:sync

Copies `lens/` into `<project>/Assets/ViroSpecs/lens/` and writes
`Assets/ViroSpecs/viro-specs.dependencies.json` with the pinned upstream
commit, the Lens Studio range and the required packages
(`SpectaclesInteractionKit.lspkg`, `SpectaclesUIKit.lspkg`,
`SurfacePlacement.lspkg`, `VolumetricLine.lspkg`, `SpecsNavigationKit.lspkg`)
plus editor-only validation packages (`Leaf.lspkg`,
`AiPreviewAgentInspect.lspkg`, `AiPreviewAgentInteract.lspkg`).

`--clean` only removes files in `Assets/ViroSpecs/lens/` that no longer exist
in `packages/specs/lens`. It never touches `.meta` files (Lens keys scene
references on them) or anything else in `Assets/ViroSpecs`: `generated/`,
`Assets/`, `Media/` and `ArchivedTemplate/` stay as they are.

### specs:typecheck-lens

Typechecks the `lens/` runtime against a Lens project's declarations: its
`Cache/StudioLib/StudioLib.d.ts`, the LensifyTS declarations and the package
sources under `Cache/TypeScript`. Open the project in Lens Studio once so the
cache exists.

### specs:validate-lens

Checks `lens/` without a Lens project: every required runtime file is
present, no file imports `@viro-external/*`, `react`, `react-native` or
`../src/`, and every `./` import points at a file in `lens/`.

### specs:bake-rive

Bakes one `.riv` file by hand into a GIF plus a `.json` manifest of each
clip's frame range. `--clips` lists `Name=Animation`, with `:loop` for a
looping clip. Specs Lenses cannot run Rive (the Lens runtime has no
WebAssembly; see `reports/rive-on-lens-2026-10-03.md`), so clips are rendered
at build time with `@rive-app/webgl2` in headless Chromium and encoded with
ffmpeg. The Chromium is `VIRO_RIVE_CHROMIUM` if set, else playwright-core's
build, else the newest `chromium-*` in `~/Library/Caches/ms-playwright`.
`specs:scene` calls the same code for every Rive panel, so you only need this
script to bake a file outside a scene.

### specs:bake-rive-native

Bakes a scene's Rive panels for native Viro through the same pipeline: clips
and buttons are read from each file the way `specs:scene` reads them. It
writes one GIF per clip under `<out>/<panel tag>/` and `<out>/index.ts`
exporting `RIVE_BAKES: Record<string, RiveBaked>`:

```tsx
import { RIVE_BAKES } from "./assets/rive-baked";

<RivePanel tag="lesson" baked={RIVE_BAKES.lesson} />
```

### specs:test-runner

Runs `node --test` on `scripts/go-clad.test.mjs`,
`scripts/render-plan.test.mjs` and `scripts/ui-scene.test.mjs`.

### Other scripts

`specs:doctor -- --project ...` (`doctor-lens-project.mjs`),
`specs:bootstrap -- --project ...` (`bootstrap-platform-lab.mjs`) and
`specs:go -- --project ... [--mcp-url URL] [--exec] [--no-auto-review]`
(`go-clad.mjs`, Lens Studio MCP setup) are also in `package.json`.

## Generated files

| File | Written by | Contents |
| --- | --- | --- |
| `Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts` | `specs:scene` | The mapped scene (`GENERATED_SCENE`), polylines, interactions, animations and baked textures, plus the `ViroGeneratedSceneHost` component. Do not edit it; change the scene file and rerun. |
| `Assets/ViroSpecs/Media/rive/<node id>.gif` | `specs:scene` | One GIF per Rive panel holding all its clips. The host loads it with `requireAsset("../Media/rive/<node id>.gif")`, so it needs no inspector wiring. |
| `Assets/ViroSpecs/lens/*` | `specs:sync` | The Lens runtime. |
| `Assets/ViroSpecs/viro-specs.dependencies.json` | `specs:sync` | Upstream pin and required packages. |

`ViroGeneratedSceneHost` has four inputs: `runtimeHostObject`,
`interactionHostObject`, `animationHostObject` and `navigationHostObject`,
the objects carrying `ViroSpecsRuntimeHost`, `ViroSpecsInteractionHost`,
`ViroSpecsAnimationHost` and `ViroSpecsNavigationHost`. On start it registers
the baked textures, applies the scene snapshot, makes the interactions
interactable (with manipulation where the node had `onDrag`), plays the
animations and presents the polylines. It throws if the runtime host is
missing, or if the scene has interactions, animations or polylines and the
matching host is missing.

## Lens runtime primitives

`src/render.ts` maps each portable node kind to a render primitive, which
`lens/ViroSpecsSceneRuntime.ts` builds:

| Node kind | Primitive | Lens object |
| --- | --- | --- |
| `group` | `scene-object` | A SceneObject. |
| `text` | `text` | `Component.Text`. |
| `image` | `image` | `Component.Image` with the registry texture. |
| `model` | `render-mesh` | An instantiated model prefab. |
| `panel` | `ui-frame` | A SpectaclesUIKit `Frame`: grab to move, corner zones to resize. The panel colour is a RoundedRectangle parented to the Frame one render-order step above its glass, because setting the Frame's own rectangle colour does not take. Children go into the Frame's `content`. |
| `surface` | `flat-surface` | A plain tinted rounded rectangle, no Frame. |
| `scroll` | `scroll-window` | A SpectaclesUIKit `ScrollWindow` in a holder object, with a custom scrollbar beside it: a track, a knob you pinch and drag, and up/down buttons that page by one window. It is built from RoundedRectangles because the installed UI Kit ScrollBar can only be wired in the editor, and sits outside the window because the ScrollWindow's collider swallowed pinches inside it. |
| `video` | `video-surface` | `Component.Image` with a video texture. With `controls`, a control bar under the video: play/pause, a seek track you can pinch or drag, and a time readout. In a panel, the Frame wraps the video at its source aspect. |
| `rive` | `rive-surface` | The baked player: `Component.Image` with the baked GIF. It plays the current clip's frame range, repeats a looping clip, moves a one-shot clip to `next`, moves on a select to `onSelect`, and puts a press target over each button drawn in the art. |

Asset ids resolve through `ViroSpecsAssetRegistry` (see `lens/README.md`).

## Worked example: Harlem Courts

`examples/harlem-courts.tsx` is one scene for both hosts. Under a `ViroNode`
tagged `platform-lab-root` it has:

- a `ViroText` title with the `platformLabPulse` animation (exported as
  `animations`), a `Viro3DObject` with `onClick` and `onDrag`, and a
  `ViroPolyline` route;
- a `SpatialPanel` (`platform-lab-panel`) whose `PanelStack` holds an image
  and bar chart row, three `PanelStat`s, headings, a wrapped paragraph and
  three `PanelSurface` rows. The stack is taller than the panel, so on Specs
  it becomes a scroll window;
- a `VideoPlayerPanel` (`platform-lab-video-panel`) on `media/demo`;
- a `RivePanel` (`platform-lab-lesson`) that plays
  `assets/moyo_learning_question.riv` live natively and, through `specs`,
  bakes five clips with buttons read from
  `assets/moyo_learning_question.inspect.json`.

Compile it into a Lens project:

```sh
pnpm specs:sync -- --project "/path/to/Lens Project"
pnpm specs:scene -- --entry examples/harlem-courts.tsx \
  --project "/path/to/Lens Project"
```

Then open the project in Lens Studio and run the LEAF scenarios
`viro_specs_scene_smoke`, `viro_specs_interaction`, `viro_specs_frame` and
`viro_specs_rive`. To play the lesson panel baked on native Viro:

```sh
pnpm specs:bake-rive-native -- --entry examples/harlem-courts.tsx --out <app assets dir>
```

## Shared Viro-side code

```ts
import { compileSpecsScene } from "@viro-external/specs";

const result = compileSpecsScene([
  {
    id: "root",
    kind: "group",
    position: [0, 0, -1.5],
  },
  {
    id: "prompt",
    parentId: "root",
    kind: "text",
    text: "Solve for x",
  },
  {
    id: "tutor",
    parentId: "root",
    kind: "model",
    source: "tutor.glb",
  },
]);

if (result.diagnostics.some((d) => d.level === "error")) {
  throw new Error("Scene is not portable to Specs");
}

const json = JSON.stringify(result.scene);
```

Supported portable node kinds in this first contract are `group`, `text`, `image`, `model`, and `panel`. Viro-specific render passes, physics internals, portals and native texture handles are intentionally not serialized.

## Runtime detection

The Specs adapter now exposes Expo-Horizon-style runtime detection:

```ts
import { SpecsRuntime, isSpecsDevice, useSpecs } from "@viro-external/specs";

if (isSpecsDevice()) {
  // Physical Spectacles.
}

const specs = useSpecs();
// specs.isDevice, specs.isEditor, specs.isBuild, specs.isRuntime
```

The implementation uses Snap's `global.deviceInfoSystem.isSpectacles()` and
`isEditor()`. Editor builds use an explicit `__VIRO_SPECS_BUILD__` marker so
an unrelated Lens Studio preview is never misidentified as a Specs build.

See `doc/RuntimeDetection.md` for exact semantics and examples.

## SPECS 27 upstream packages

The long-term renderer is pinned to the public `specs-devs/packages` SPECS 27 package set instead of reimplementing every Lens Studio primitive from scratch. The pin, package roles, upgrade rules, and licensing notes live in `upstream/specs-27.json` and `doc/UpstreamIntegration.md`.

The minimum renderer uses upstream scene/component access, instantiation, native AnimationPlayer patterns, SIK interaction helpers, WorldQuery hit testing, and SurfacePlacement. Navigation, volumetric lines, camera helpers, shaders, and automated agent inspection are opt-in capability layers.

## Lens Studio runtime boundary

The Lens Studio side implements `SpecsRuntimeTransport`:

```ts
type SpecsRuntimeTransport = {
  getCapabilities(): XRCapabilityReport;
  applyScene(scene: SpecsSceneSnapshot): void | Promise<void>;
  onInteraction(
    listener: (event: PortableXRInteraction) => void
  ): () => void;
  dispose(): void | Promise<void>;
};
```

That bridge maps:

```text
Portable group  -> Lens Studio SceneObject hierarchy
Portable text   -> Lens Studio text/UI visual
Portable image  -> Lens Studio image/material visual
Portable model  -> imported Lens Studio asset / render mesh
Portable panel  -> Spectacles UI Kit / Interaction Kit surface

gaze/hand hover -> PortableXRInteraction hover-*
pinch/trigger   -> select-start / select-end
drag            -> drag
```


## Moyo layout reuse

The Moyo Learn three-slot XR composition is useful here because its `worldSlot` transform is engine-independent. The same left/center/right poses that Viro uses can be serialized into `PortableXRNode` transforms and applied to Lens Studio SceneObjects.

That means we keep one authored spatial composition instead of creating a Snap-specific set of magic numbers.

See `doc/Architecture.md` for the ownership and validation rules.

## Camera example

Camera remains a Snap-native capability rather than a Viro texture contract. On Spectacles, Lens Scripting exposes `LensStudio:CameraModule`, including high-resolution still capture suitable for OCR-style workflows:

```js
const CameraModule = require("LensStudio:CameraModule");

async function captureStill() {
  const request = CameraModule.createImageRequest();
  const frame = await CameraModule.requestImage(request);
  return frame.texture;
}
```

Keep camera frames inside the Snap runtime unless the product explicitly needs to transfer them elsewhere; Snap applies privacy restrictions when camera/user APIs are combined with internet or cross-session APIs.

## Mobile continuity

Snap also provides Mobile Kit for continuity between Spectacles experiences and mobile apps. That can become a transport option later, but it should not be confused with the renderer bridge itself.

## Current PR boundary

This PR establishes the portable scene compiler and runtime transport contract. A follow-up Lens Studio package should implement the actual SceneObject/UI Kit/SIK mappings and run in the Spectacles simulator/device before this target is marked renderer-complete.
