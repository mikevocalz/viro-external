# Lens Studio runbook

The standard procedure for getting an app that uses `@viro-external/specs` running in Lens Studio 5.24.1 Preview (SPECS 27 target), and then on Spectacles.

Every fact below was checked on 2026-10-14 and 2026-10-15 against the Harlem Might Specs project in Lens Studio 5.24.1 Preview. Apart from the push command in step 11, none of it was checked on Spectacles hardware. Step 11 covers the device run.

Runtime images (`registerImage`, PR #69) and scroll groups (`scroll`, PR #70) are on `main` as of 2026-10-15.

To write the Lens UI itself (layouts, buttons, lists, data, WebView), see [BuildingSpecsApps.md](./BuildingSpecsApps.md) and the runnable sample in [`examples/specs-sample/`](../examples/specs-sample/README.md).

Run every package script from the repo root. The local `pnpm` shim on the machine used for this runbook is broken, so the commands go through `npx -y pnpm@12.8.1`, the version pinned in the root `packageManager`. A working `pnpm` 12.8.1 runs the same commands.

## Procedure

### 1. Copy the Platform Lab project

Copy the Platform Lab project folder under `~/Documents/Lens Studio/` to a new folder for your app, and open the copy. Never edit the original lab project; it is the known-good reference you compare against when something breaks.

The scripts expect exactly one `.esproj` in the folder you pass them. Do not leave a backup `.esproj` next to the real one.

### 2. Check the project

```bash
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:doctor -- --project "/abs/path/MyAppSpecs"
```

`specs:doctor` fails unless the folder has one `.esproj`, `targetPlatform: Spectacles`, Lens Studio 5.22 or later, and every required Lens package at or above its minimum version. It reads the version from each package's `package.native`, so an empty or outdated archive fails too. Install or update the package it names through the Asset Library (see [README step 3](../README.md#3-install-lens-packages)). [SyncAndDoctor.md](./SyncAndDoctor.md) lists every check. Installing a package through the MCP also drops its demo objects into the scene; delete them.

If the Lens fetches `http://` URLs (a local dev server) or uses WebView, tick **Project Settings > Experimental API** and save. Lens Studio stores this as `EXPERIMENTAL_API` in `metaInfo.lensDescriptors` in the `.esproj`. The `.esproj` also has a `spkPrivilegeLevel` field, which is a different setting: editing it by hand does nothing useful, because the next save overwrites it, and the Editor API has no setter for it.

### 3. Sync the Lens runtime

```bash
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:validate-lens
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:sync -- --project "/abs/path/MyAppSpecs"
```

`specs:sync` copies the production runtime to `<project>/Assets/ViroSpecs/lens/`. Add `--with-validation` for the LEAF scenarios, AiPreviewAgent checks and Platform Lab, which go to `Assets/ViroSpecsValidation/lens/` and need the Leaf and AiPreviewAgent packages. The sync replaces files in place and never touches `.meta` files, so Inspector references survive a resync. It keeps any file you edited and lists it; `--force-overwrite <path>` replaces one.

`specs:bootstrap -- --project <path>` runs the doctor, a sync with `--with-validation`, and the doctor again. `specs:go` adds the Lens Studio MCP and Codex setup; see [OneCommandCLAD.md](./OneCommandCLAD.md).

### 4. Move stale scripts out of Assets

`specs:sync` removes a file the SDK stopped shipping only when its ownership ledger (`viro-specs.owned.json`) lists the file and you have not edited it. Scripts from older branches, files synced before the ledger existed, and anything elsewhere in `Assets/` stay in the project and can fail Lens Studio's TypeScript compile. `specs:doctor` warns about validation scripts an older sync left in `Assets/ViroSpecs/lens/`; [SyncAndDoctor.md](./SyncAndDoctor.md#projects-synced-before-the-ledger) covers that migration.

Compare `Assets/ViroSpecs/lens/` against `packages/specs/lens/` and look for any other app scripts from an earlier branch. Move each stale file to a folder outside `Assets/` (for example `<project>/_stale/`). Do not delete them; you may need one back. Recompile and confirm the Logger shows no TypeScript errors before you continue.

### 5. Wire the app entry script

Create your app's entry script (the Harlem Might project uses `HarlemMightSpecsEntry.ts`) on its own SceneObject, with these Inspector inputs:

| Input | Points at | Required |
| --- | --- | --- |
| `presentationHostObject` | the `ViroSpecsRuntime` object, which holds `ViroSpecsPresentationHost` | yes |
| `navigationObject` | the "Navigation Kit Menu" object, which holds `NavigationDataComponent` | only for Navigation Kit walks |
| `arNavigationObject` | the "AR Navigation" object, which holds `ARNavigation` | only for Navigation Kit walks |

Disable the `ViroSpecsPlatformLab` demo object that came with the copy, so only your app presents a page.

A component lower in the hierarchy initializes after one higher up, so a callback you set on it in `onAwake` can be overwritten by its own initialization. Wire callbacks in `OnStartEvent`.

### 6. Fill the AssetRegistry

`ViroSpecsAssetRegistry` sits on a child of `ViroSpecsRuntime`. Set:

- `imageIds` and `imageTextures` as parallel arrays: index *n* of the IDs maps to index *n* of the textures. Harlem Might maps `harlem-might-logo` to its logo texture.
- `defaultImageMaterial`: the material from step 7. The lab's own materials do not work.
- `defaultPanelPrefab`: `ViroLabPanel`, the lab's UI Kit panel prefab.
- `defaultFont`: `SpecsSans-Medium`.

Textures created at runtime, such as photos loaded with `RemoteMediaModule`, are not in the Inspector arrays. Call `ViroSpecsAssetRegistry.registerImage(id, texture)` before you present a node whose source is that id.

### 7. Create a working image material

Create a new **Unlit** material in the Asset Browser and set:

- Blend Mode: **Normal**
- Depth Write: **off**
- Graph Parameters: enable **Base Texture**

Assign it as the registry's `defaultImageMaterial`. With this material, PNG alpha renders correctly. See [Known traps](#image-nodes-render-nothing) for why the lab's materials fail.

### 8. Present a page

In the entry script, once the runtime hosts have initialized, call `presentationHost.subscribeAction(handler)` and then `presentationHost.present(payload)`. Build the payload with `compileSpecsPresentation({ scene, targets })` on the app side. [LivePresentation.md](./LivePresentation.md) covers the protocol.

Style text nodes with `textStyle: { size, color }` (`size` in Lens text points, `color` as linear RGBA from 0 to 1). Text nodes without it render at 48 points.

A group node can scroll: set `scroll: { width, height, contentHeight }` in metres and the host builds a UI Kit `ScrollWindow` on a child named `viro-scroll:<id>`, calling `initialize()` on it right after `createComponent`. Children of that group use content coordinates, with y = 0 at the content top and negative downward. There is no ScrollBar, because its inputs are private. `present()` rebuilds the window at the top, so an app that re-presents the same page must keep the offset itself: read `ScrollWindow.scrollPosition` before `present()` and set it again after.

Lens has no `Intl` time zones. Port any date formatting that relies on them.

### 9. Run Preview

Press Preview and pick a SPECS 27 Interactive Preview room. Check, in this order:

1. The Logger has no compile errors and no runtime throws from `ViroSpecs*`.
2. Images draw, with transparent areas transparent.
3. Every image and panel is the size you intended. Measure it in Preview; see [Known traps](#image-scale-is-not-centimeters).
4. Pinch on every action target fires its action, and page replacement works more than once.

For Navigation Kit walks, set simulated GPS from the dropdown at the bottom left of the Preview panel. It offers **Start** and **Custom Location**.

The same checks run through the Lens Studio MCP without touching the screen:

1. `RecompileTypeScriptTool`.
2. `RunAndCollectLogsTool` with refresh.
3. `QueryRuntimeSceneTool` to find the `viro-interactable:<id>` uniqueIds.
4. `PreviewInteractTool` with Pinch on a target, or Drag on a `viro-scroll:<id>` uniqueId to scroll a ScrollWindow.
5. `CapturePanelScreenshotTool` on `Snap.Plugin.Gui.PreviewPanel`, or `CaptureRuntimeViewTool` with isolate.

`ExecuteEditorCode` can set script inputs, create scene objects, instantiate prefabs and save with `project.save()`. `QueryLensStudioKnowledgeBase` needs a Snap login in Lens Studio.

### 10. Run the repo checks

These are the checks that exist in the repo. None of them compiles `lens/` the way Lens Studio does, so they back up step 9 and do not replace it.

| Command (`npx -y pnpm@12.8.1 --filter <pkg> <script>`) | What it checks |
| --- | --- |
| `@viro-external/xr-contract build` | Builds the contract `specs` depends on. Run it before `specs build` |
| `@viro-external/specs typecheck` | `tsc --noEmit` over `src/`. Does not cover `lens/` |
| `@viro-external/specs build` | ESM and CommonJS output in `dist/` |
| `@viro-external/specs specs:validate-lens` | The required `lens/*.ts` files exist, no Lens file imports `@viro-external/*`, `react`, `react-native` or `../src/`, and every `./` import resolves. Static only |
| `@viro-external/specs specs:test-presentation` | `scripts/presentation.test.mjs`. Run after `build` |
| `@viro-external/specs specs:test-lens` | `scripts/lens-files.test.mjs` and `scripts/lens-doctor.test.mjs`: the production/validation split, sync ownership, every doctor check |
| `@viro-external/specs specs:test-runner` | `specs:go` tests against a fixture MCP server and a mock Codex |
| `@viro-external/specs specs:test-bundle` | Builds, then runs `scripts/viro-bundle.test.mjs` |
| `@viro-external/specs specs:doctor -- --project <path>` | The Lens project's target, Lens Studio version, installed package versions and sync state. Exits 1 on any error |

`prepack` runs the build, `specs:validate-lens`, `specs:test-lens`, `specs:test-runner`, `specs:test-presentation`, `specs:test-host` and the bundle test together. At the root, `pnpm typecheck` runs `typecheck` in every package that has one.

### 11. Run on Spectacles

Push the Lens to Spectacles from Lens Studio. Through `ExecuteEditorCode`, get the `LensStudio:PushToDevice` interface (`IPushToDevice`) with `pluginSystem.findInterface`, check `isSpectaclesConnected()`, then call `push([PushType.Spectacles])`. This repo has no scripts or recorded on-device evidence for this step. Repeat the step 9 checks on the device, and record them separately (see [Evidence](#evidence)).

## Evidence

Preview evidence is not hardware evidence. Keep two lists for every run:

- **Preview:** Lens Studio version, Preview room, what you checked, and the result.
- **Spectacles:** device, OS version, what you checked, and the result.

A check passed in Preview goes in the Preview list only. If nothing ran on hardware, say so. Also list which repo checks from step 10 you ran and their results.

## Known traps

### Image nodes render nothing

The Platform Lab ships two image materials, `ViroSpecsImageMaterial` and `ViroSpecsImageMaterial2`. One is empty and the other is missing its shader, so with either one as `defaultImageMaterial` no image ever appears. Create the Unlit material from step 7.

### Image scale is not centimeters

Measured against a 50 cm frame in Preview, one unit of image `scale` drew about 1 cm: a 3:1 logo at `[36, 12]` came out about 36 cm wide, and `[30, 10]` about 30 cm. Portable `scale` passes through with no unit conversion, and the drawn size also depends on the texture. Measure against a frame of known size in Preview; do not compute it.

### Pinch does nothing on a new page

SIK fits an Interactable's collider to the first visual under the bound node. On the frame a page is presented, the UI Kit BackPlate has no mesh yet, so a bind in that frame fits the collider to the text label and SIK never reports a hit. Bind one frame later with a `DelayedCallbackEvent`.

`ViroSpecsPresentationHost` on `feat/specs-text-style` (PR #68) does this. It also keeps a generation counter, so a `present()` or `clear()` before the delayed bind runs cancels it. If you write your own host, do both.

### Every label is the same size

Before PR #68, every text node rendered at 48 points no matter what the app wanted. With PR #68, set `textStyle` on each text node (step 8).

### Frames draw over their text

The presentation host adds a `Component.Canvas` to each top-level node so UI Kit frames draw behind the text and models under them. A custom host that skips this gets frames on top of their labels.

### "Object is null" errors during page swaps

SIK's cursor holds the hovered Interactable for a frame. When a page swap destroys that SceneObject, the cursor's read throws "Object is null". PR #68's `resetTargets()` calls `clearCurrentInteractable()` on every interactor still holding a retiring Interactable. In a 6-replacement Preview run that cut the errors from 6 to 2. The remaining 2 come from inside SIK and SIK catches them; they do not stop the page.

### Stale scripts break the compile

See step 4. `specs:sync` removes only files its ledger owns and you did not edit. Move other stale files out by hand.

### Fetch fails with "URL is not secure"

Without Experimental API, the Lens fetches `https://` only and fails with "URL is not secure (Experimental API must be enabled to access insecure URLs)". Enable it as in step 2. Spectacles also can't reach the Mac's `localhost`: use the Mac's LAN IP with both on the same Wi-Fi, or a public `https://` host.

### WebView is blank in Preview

Lens Studio Preview creates the WebView texture and accepts `loadUrl`, but renders nothing; only Spectacles render it. `onReady` may never fire, so load the URL shortly after the texture callback instead of waiting for it. To hide the WebView, disable its Image component, not the SceneObject holding the script, or that script's `DelayedCallbackEvent`s and callbacks stop. Page controls need input: forward SIK pinches with `WebPageTextureProvider.touch()`.

### A deleted script keeps failing the compile

A file removed from `Assets/` while Lens Studio is running can stay registered and keep failing compilation. Restoring the file, or installing the dependency it was missing, clears it.

### `openProject` refuses the open project

Lens Studio's `openProject` will not reopen the project that is already open; it reports it as "in use by another instance". Open another project, then switch back.

### The lens-studio MCP is not connected

Claude Code connects the `lens-studio` MCP server only when a session starts. If Lens Studio was launched after the session, run `/mcp` to reconnect.

### Lens Studio AI does nothing

Lens Studio AI needs the developer logged in to Lens Studio.

### `pnpm` fails on this machine

The local `pnpm` shim is broken. Use `npx -y pnpm@12.8.1 <cmd>`.
