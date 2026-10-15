# Specs sample

A two-tab Spectacles page built on `ViroSpecsPresentationHost`: a header with one registry image, a left tab rail (Places, Music), a scrolling two-column list of cards, and a detail page with Back. It runs on built-in sample data. With an Internet Module and a URL it loads its cards from JSON instead.

| File | What it is |
| --- | --- |
| `SpecsSampleApp.ts` | The Lens component: inputs, actions, optional fetch, scroll offset kept across redraws |
| `SpecsSampleLayout.ts` | Pure page builder and sample data, no Lens globals |
| `SpecsSampleLayout.test.ts` | Node tests for the page builder. Don't copy it into the Lens project |

[`doc/BuildingSpecsApps.md`](../../doc/BuildingSpecsApps.md) explains each pattern used here.

## Requirements

- Lens Studio 5.22 or later; checked against 5.24.1.
- The Viro Specs runtime with scroll groups, from PR #70 (`feat/specs-scroll-window`), not yet merged into `main`. On `main` the list's `scroll` field fails validation.
- `SpectaclesInteractionKit.lspkg` and `SpectaclesUIKit.lspkg` installed in the project.

## Setup

1. Sync the runtime into your project. On a project that is already wired, leave out `--clean`:

   ```bash
   npx -y pnpm@12.8.1 --filter @viro-external/specs specs:sync -- --project "/abs/path/MyAppSpecs"
   ```

2. Copy `SpecsSampleApp.ts` and `SpecsSampleLayout.ts` to `<project>/Assets/SpecsSample/`. The imports expect `Assets/ViroSpecs/lens/` one folder up.

3. Wire the hosts if the project doesn't have them yet (the Platform Lab copy does): `ViroSpecsAssetRegistry`, `ViroSpecsRuntimeHost` (`assetRegistryObject`), `ViroSpecsInteractionHost` (`runtimeHostObject`) and `ViroSpecsPresentationHost` (`runtimeHostObject`, `interactionHostObject`).

4. Fill the registry:
   - `defaultPanelPrefab`: a UI Kit frame prefab, `ViroLabPanel` in the Platform Lab.
   - `defaultFont`: `SpecsSans-Medium`.
   - `defaultImageMaterial`: a new **Unlit** material with Blend Mode **Normal**, Depth Write **off** and Graph Parameters **Base Texture** on.
   - `imageIds` / `imageTextures`: add `sample-logo` with any square texture, at the same index in both arrays.

5. Create a SceneObject, add **SpecsSampleApp**, and set:

   | Input | Value |
   | --- | --- |
   | `presentationHostObject` | the object with `ViroSpecsPresentationHost` |
   | `assetRegistryObject` | the object with `ViroSpecsAssetRegistry` |
   | `headerImageId` | `sample-logo`, or empty for no header image |
   | `internetModule` | optional; an Internet Module asset |
   | `dataUrl` | optional; see below |

   Disable `ViroSpecsPlatformLab` and any other script that presents a page.

6. Press Preview and pick a SPECS 27 Interactive Preview room.

## What you should see

- A 50 x 50 cm card 1.1 m ahead, a little below eye level, with "Specs Sample" in gold and the logo at the top left.
- A narrow rail on the card's left with Places and Music. The active tab is gold with a gold bar.
- Places: six cards in two columns inside a scroll window, three rows of 13 cm. Drag the window to scroll.
- Pinch a card: its detail page with title, address, a paragraph and a Back button. Back returns to the list where you left it.
- Music: three cards. Switching tabs resets the list to the top.

If the header image is missing, `sample-logo` isn't registered; the app leaves the image out rather than failing the page. If nothing draws at all, check the Logger for `ViroSpecs*` errors and the image material in step 4.

## Loading cards from JSON

Set `internetModule` and `dataUrl` to an endpoint returning:

```json
{
  "places": [{ "id": "apollo", "title": "Apollo Theater", "sub": "253 West 125th Street", "body": "..." }],
  "music": [{ "id": "big-l", "title": "Big L", "sub": "Hip-hop", "body": "..." }]
}
```

Both tabs show "Loading…" until the response arrives. A tab missing from the response, or a failed request, keeps the sample cards with an "Offline: showing sample data" line. Use `https://`; `http://` needs **Project Settings > Experimental API**. Spectacles can't reach your Mac's `localhost`, so use its LAN IP on the same Wi-Fi or a public host.

## Checks

Not scanned by `specs:validate-lens`, which only reads `packages/specs/lens/`. What was run on 2026-10-15:

- `SpecsSampleApp.ts` and `SpecsSampleLayout.ts` typecheck with the TypeScript compiler against Lens Studio 5.24.1's declarations and the Harlem Might project's synced runtime and packages. That is a compile check, not a Lens Studio Preview run.
- `node --test packages/specs/examples/specs-sample/SpecsSampleLayout.test.ts`: 6 of 6 pass (Node 26).

The sample has not been run in Lens Studio Preview or on Spectacles.
