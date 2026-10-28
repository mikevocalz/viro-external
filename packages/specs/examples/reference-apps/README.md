# Reference apps

The three viro reference apps (`examples/specs-reference-apps/` in
`@reactvision/react-viro`) as compiled scene documents, a Node test that runs
them on the mock host, and LEAF scenarios for Lens Studio Preview.

| File | What it is |
| --- | --- |
| `scenes/dashboard.scene.json`, `scenes/model-viewer.scene.json`, `scenes/world-placed-info.scene.json` | Scene protocol 2 documents, byte for byte the viro goldens `__test__/fixtures/specs/reference-apps/<app>/scene.json` |
| `gen-lens-scenes.mjs` | Embeds the three documents in `leaf/ViroRefAppScenes.ts`; `--check` exits 1 when that file is stale |
| `reference-apps.test.mjs` | Node test on the mock host. Not part of the Lens project |
| `leaf/ViroRefAppScenes.ts` | Generated. The documents for the Lens, where a script cannot read a JSON file |
| `leaf/ViroRefAppsLogic.ts` | State, action handlers and state-to-scene views for each app. No imports, no Lens globals; the Node test and the scenarios share it |
| `leaf/ViroRefAppsLeafSupport.ts` | Shared scenario steps: host lookups, starting an app on the action runtime, the experience host, WorldQuery injection |
| `leaf/ViroRef*Scenario.ts` | Ten scenarios |
| `leaf/ViroRefAppsLeafIndex.ts` | Registers the ten scenarios with LEAF |

Nothing in `lens/` imports these files, and `specs:sync` does not copy them.

## Node test

From `packages/specs`:

```bash
node scripts/build-lens-core.mjs && node --test examples/reference-apps/reference-apps.test.mjs
```

It checks that each document passes the host reader, carries this host's
theme and labels every interactable; that it commits and reaches `ready` on
the mock backend with every interaction bound; and that the only host
diagnostics are the `VS5008` notices pinned per node (see below). Then it runs
each app's typed-action loop: range pinch to new readings, turn/resize/reset
to the expected transform deltas, a drag, a missing GLB to the placeholder and
Retry panel, and placement confirm and cancel through
`ViroSpecsPlacementSession`.

`VS5008` ("maxLines is approximated by the text box height", a warning) is
raised once per text node with `maxLines`, and every `PanelText` carries
`maxLines`, so every PanelText raises it. The Platform Lab gallery scenes do
the same. The test pins the exact list and allows nothing else.

## Running the scenarios in Lens Studio

Needs Lens Studio 5.22 or later with the SPECS 27 Preview, and the LeafPlugin
(Asset Library, then enable it under Settings > Plugin Manager and restart).

### 1. Open the Platform Lab project

Use the viro repo's Platform Lab project:
`examples/specs-platform-lab/lens/ViroSpecsPlatformLab.esproj`. It already has
the hosts the scenarios use: `SceneHost` (ViroSpecsSceneControllerHost),
`ExperienceHost` (ViroSpecsExperienceHost, disabled), `GeneratedHost`,
`AssetRegistry` with `shiba.glb` registered as
`examples/visionos-sweep/assets/shiba.glb`, `Camera Object`, and the
`Leaf.lspkg` and `SpectaclesInteractionKit.lspkg` packages.

That project is on viro branch `feat/specs-lens-experience`. On 2026-10-28 it
was not in the `feat/specs-release` checkout, and this package has no Lens
project of its own. Check out the branch that carries it.

### 2. Sync the runtime

The scenarios need this branch's `ViroSpecsActionRuntime`,
`ViroSpecsExperienceLensView` and `ViroSpecsSceneControllerHost`. From the
viro-external repo root:

```bash
npx -y pnpm@12.8.1 --filter @viro-external/specs specs:sync -- --project "/abs/path/to/viro/examples/specs-platform-lab/lens"
```

### 3. Copy the scenarios

Copy every `.ts` file in `leaf/` (14 files) to
`<project>/Assets/ViroSpecsRefApps/Leaf/`. The imports expect
`Assets/ViroSpecs/lens/` two folders up. Do not copy `scenes/`,
`gen-lens-scenes.mjs` or `reference-apps.test.mjs`: the documents are already
embedded in `ViroRefAppScenes.ts`.

After changing a viro app: refresh its goldens, copy `scene.json` to
`scenes/`, run `node examples/reference-apps/gen-lens-scenes.mjs`, and copy
`leaf/ViroRefAppScenes.ts` again.

### 4. Attach the index

1. In the Scene Hierarchy, add a root SceneObject named `RefAppsLeafIndex`.
2. Add a Script component and set its script to `ViroRefAppsLeafIndex`.
3. Keep the Platform Lab's `LeafIndex`. Each index registers its own
   scenarios, so the LEAF panel lists both sets.
4. Save. The Logger should show no TypeScript errors. The files typecheck
   against the Platform Lab project's Lens and LEAF declarations (checked
   outside Lens Studio with the project's `tsconfig.json`).

### 5. Run

1. Set the Preview device to a SPECS 27 Interactive Preview room.
2. Open the LEAF panel (installed by the LeafPlugin) and wait for the list to
   show the `viro_ref_*` IDs.
3. Run one scenario at a time and wait for each to finish. LEAF resets the
   Lens before each run; starting a second run while one is going aborts the
   first.
4. A failed run gives no reason in the panel. Read the Lens Studio log for the
   scenario manager's `FAILED` line; each scenario also prints
   `VIRO_REF <name> ...` lines with what it measured.

Scenarios with a `hold_ms` parameter keep the screen still that many
milliseconds at the marked step (`VIRO_REF_HOLD <label>`) so you can take a
capture. The default is 0.

### Expected results

| Scenario ID | Class | Asserts | Expected |
| --- | --- | --- | --- |
| `viro_ref_dashboard_ready` | `ViroRefDashboardReadyScenario` | Dashboard commits and reaches `ready` with no host findings; title "Workshop sensors"; the three 24 h readings and status; an Interactable on each range control and Refresh | Pass |
| `viro_ref_dashboard_range` | `ViroRefDashboardRangeScenario` | Pinching "7 d" delivers `dashboard.set-range`, the readings change from what they were to the 7 d values, and the status changes; Refresh raises the count by one and the status ends ", refreshed" | Pass |
| `viro_ref_dashboard_ik` | `ViroRefDashboardIKScenario` | LEAF's IK arm pinches Refresh (far-field ray at 1.5 m) and the refresh count rises by one | Pass. A reach that does not converge fails it; that is a reachability finding about the layout |
| `viro_ref_model_ready` | `ViroRefModelReadyScenario` | Model viewer reaches `ready`, `viro-model:mv-model` exists, no placeholder, status "Facing front, size 100 %", model and five controls interactable | Pass |
| `viro_ref_model_transform` | `ViroRefModelTransformScenario` | Turn right rotates the model 45° (±0.5°) from where it was; Larger scales it ×1.2; Reset restores both; an SIK drag moves it more than 3 cm and reports `drag` | Pass |
| `viro_ref_model_missing_asset` | `ViroRefModelMissingAssetScenario` | With an unregistered GLB: `VS5003` for `mv-model`, `viro-placeholder:mv-model`, error panel "Model didn't load" with Retry, the controls still work, Retry hands `mv-model` to the retry listener | Pass |
| `viro_ref_placement_ready` | `ViroRefPlacementReadyScenario` | World-placed info reaches `ready` with no findings; the card is committed but hidden; idle prompt; "Place card" interactable; Cancel hidden | Pass |
| `viro_ref_placement_confirm` | `ViroRefPlacementConfirmScenario` | "Place card" starts placement; an injected table hit shows "Table. Pinch to place."; confirm sends `placement.confirm` and the card shows within 3 cm of the hit; prompt and button change | Pass |
| `viro_ref_placement_cancel` | `ViroRefPlacementCancelScenario` | After a valid hit then none for 1.5 s the placement session reports "Placement cancelled" and the reticle is hidden (its Text keeps the last label); confirm places nothing; Cancel returns to the idle prompt with the card still hidden | Pass |
| `viro_ref_expected_failure` | `ViroRefExpectedFailureScenario` | Asserts the dashboard title is "REF_EXPECTED_FAILURE: this title does not exist" | **Fails**, with expected "REF_EXPECTED_FAILURE: this title does not exist" and received "Workshop sensors". If it passes, the harness is broken |

Findings leave out `VS5008` (see above). They also filter `VS5025`, which
the current host never raises: it draws the ModelViewer load ring, Reset
model and `autoRotate`, so the list of features it does not draw is empty.

Preview has no SPECS depth, so the placement scenarios replace the
experience host's WorldQuery session with one that reports a fixed hit, as
the WS4 placement scenarios do.

Evidence: the Node test is `portable-test-passed`. The LEAF scenarios are
`preview-validated`: the Platform Lab copy in viro (branch
`feat/specs-lens-experience`, `docs/evidence/specs/lens/ws4-08-polish2/leaf-suite/`)
ran all ten in Lens Studio Preview on SPECS 27. Nine passed and
`viro_ref_expected_failure` failed as required. The lab copies of the
scenario files are byte-identical to the ones here. Two changes came after
that run and have not been run in Preview: the dashboard panel moved from
y 0 to y -0.22, and the high-contrast surface changed from `#000000` to
`#42525f`.
