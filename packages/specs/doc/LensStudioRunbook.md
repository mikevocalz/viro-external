# Lens Studio runbook

The standard procedure for getting an app that uses `@viro-external/specs` running in Lens Studio 5.24.1 Preview (SPECS 27 target), and then on Spectacles.

Every fact below was checked on 2026-10-14 against the Harlem Might Specs project in Lens Studio 5.24.1 Preview. None of it was checked on Spectacles hardware. Step 11 covers the device run.

Run every package script from the repo root. The local `pnpm` shim on the machine used for this runbook is broken, so the commands go through `npx -y pnpm@12.8.1`, the version pinned in the root `packageManager`. A working `pnpm` 12.8.1 runs the same commands.

## Procedure

### 1. Copy the Platform Lab project

Copy the Platform Lab project folder under `~/Documents/Lens Studio/` to a new folder for your app, and open the copy. Never edit the original lab project; it is the known-good reference you compare against when something breaks.

The scripts expect exactly one `.esproj` in the folder you pass them. Do not leave a backup `.esproj` next to the real one.

### 2. Check the project

```bash
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:doctor -- --project "/abs/path/MyAppSpecs"
```

`specs:doctor` fails unless the folder has one `.esproj`, `targetPlatform: Spectacles` and Lens Studio 5.22 or later. It warns about missing Lens packages and an unsynced runtime. Install any missing package through the Asset Library (see [README step 3](../README.md#3-install-lens-packages)).

### 3. Sync the Lens runtime

```bash
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:validate-lens
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:sync -- --project "/abs/path/MyAppSpecs"
```

`specs:sync` copies `packages/specs/lens/` to `<project>/Assets/ViroSpecs/lens/`. Do not pass `--clean` on a wired project: it deletes the Lens `.meta` files, the scripts get new asset identities, and every Inspector reference to them breaks.

`specs:bootstrap -- --project <path>` runs the doctor and then a sync without `--clean`. `specs:go` adds the Lens Studio MCP and Codex setup; see [OneCommandCLAD.md](./OneCommandCLAD.md).

### 4. Move stale scripts out of Assets

Without `--clean`, `specs:sync` overwrites files but never removes them. Scripts left from older branches, in `Assets/ViroSpecs/lens/` or elsewhere in `Assets/`, stay in the project and fail Lens Studio's TypeScript compile.

Compare `Assets/ViroSpecs/lens/` against `packages/specs/lens/` and look for any other app scripts from an earlier branch. Move each stale file to a folder outside `Assets/` (for example `<project>/_stale/`). Do not delete them; you may need one back. Recompile and confirm the Logger shows no TypeScript errors before you continue.

### 5. Wire the app entry script

Create your app's entry script (the Harlem Might project uses `HarlemMightSpecsEntry.ts`) on its own SceneObject, with these Inspector inputs:

| Input | Points at | Required |
| --- | --- | --- |
| `presentationHostObject` | the `ViroSpecsRuntime` object, which holds `ViroSpecsPresentationHost` | yes |
| `navigationObject` | the "Navigation Kit Menu" object, which holds `NavigationDataComponent` | only for Navigation Kit walks |
| `arNavigationObject` | the "AR Navigation" object, which holds `ARNavigation` | only for Navigation Kit walks |

Disable the `ViroSpecsPlatformLab` demo object that came with the copy, so only your app presents a page. If both run, the lab page and your page share the same runtime host.

### 6. Fill the AssetRegistry

`ViroSpecsAssetRegistry` sits on a child of `ViroSpecsRuntime`. Set:

- `imageIds` and `imageTextures` as parallel arrays: index *n* of the IDs maps to index *n* of the textures. Harlem Might maps `harlem-might-logo` to its logo texture.
- `defaultImageMaterial`: the material from step 7. The lab's own materials do not work.
- `defaultPanelPrefab`: `ViroLabPanel`, the lab's UI Kit panel prefab.
- `defaultFont`: `SpecsSans-Medium`.

### 7. Create a working image material

Create a new **Unlit** material in the Asset Browser and set:

- Blend Mode: **Normal**
- Depth Write: **off**
- Graph Parameters: enable **Base Texture**

Assign it as the registry's `defaultImageMaterial`. With this material, PNG alpha renders correctly. See [Known traps](#image-nodes-render-nothing) for why the lab's materials fail.

### 8. Present a page

In the entry script, once the runtime hosts have initialized, call `presentationHost.subscribeAction(handler)` and then `presentationHost.present(payload)`. Build the payload with `compileSpecsPresentation({ scene, targets })` on the app side. [LivePresentation.md](./LivePresentation.md) covers the protocol.

Style text nodes with `textStyle: { size, color }` (`size` in Lens text points, `color` as linear RGBA from 0 to 1). Text nodes without it render at 48 points.

### 9. Run Preview

Press Preview and pick a SPECS 27 Interactive Preview room. Check, in this order:

1. The Logger has no compile errors and no runtime throws from `ViroSpecs*`.
2. Images draw, with transparent areas transparent.
3. Every image and panel is the size you intended. Measure it in Preview; see [Known traps](#image-scale-is-not-centimeters).
4. Pinch on every action target fires its action, and page replacement works more than once.

For Navigation Kit walks, set simulated GPS from the dropdown at the bottom left of the Preview panel. It offers **Start** and **Custom Location**.

### 10. Run the repo checks

These are the checks that exist in the repo. None of them compiles `lens/` the way Lens Studio does, so they back up step 9 and do not replace it.

| Command (`npx -y pnpm@12.8.1 --filter <pkg> <script>`) | What it checks |
| --- | --- |
| `@viro-external/xr-contract build` | Builds the contract `specs` depends on. Run it before `specs build` |
| `@viro-external/specs typecheck` | `tsc --noEmit` over `src/`. Does not cover `lens/` |
| `@viro-external/specs build` | ESM and CommonJS output in `dist/` |
| `@viro-external/specs specs:validate-lens` | The required `lens/*.ts` files exist, no Lens file imports `@viro-external/*`, `react`, `react-native` or `../src/`, and every `./` import resolves. Static only |
| `@viro-external/specs specs:test-presentation` | `scripts/presentation.test.mjs`. Run after `build` |
| `@viro-external/specs specs:test-runner` | `specs:go` tests against a fixture MCP server and a mock Codex |
| `@viro-external/specs specs:test-bundle` | Builds, then runs `scripts/viro-bundle.test.mjs` |
| `@viro-external/specs specs:doctor -- --project <path>` | The Lens project's target, Lens Studio version, packages and sync state |

`prepack` runs the build, `specs:validate-lens`, `specs:test-runner`, `specs:test-presentation` and the bundle test together. At the root, `pnpm typecheck` runs `typecheck` in every package that has one.

### 11. Run on Spectacles

Push the Lens to Spectacles from Lens Studio. This repo has no scripts or recorded evidence for this step. Repeat the step 9 checks on the device, and record them separately (see [Evidence](#evidence)).

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

See step 4. `specs:sync` without `--clean` leaves old files in place, and `--clean` breaks scene references. Move stale files out by hand.

### The lens-studio MCP is not connected

Claude Code connects the `lens-studio` MCP server only when a session starts. If Lens Studio was launched after the session, run `/mcp` to reconnect.

### Lens Studio AI does nothing

Lens Studio AI needs the developer logged in to Lens Studio.

### `pnpm` fails on this machine

The local `pnpm` shim is broken. Use `npx -y pnpm@12.8.1 <cmd>`.
