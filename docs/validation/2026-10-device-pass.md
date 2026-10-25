# Device pass, October 2026: Baseline vs Candidate

[Performance procedure](PERFORMANCE.md) · [First session checklist](first-session-checklist.md) · [Round 2 procedure](../DEVICE_VALIDATION.md)

This is the §6.4 deliverable of the "Viro PR Stack: Device Validation and #112 Hardening" prompt (2026-10-25). It holds the build plan, the scripts that run the pass, and the results matrix. No row has run. Every result cell says **not yet run**, and a row with no capture stays unverified, never "pass".

Supported matrix (gate 1, decided by Mike): **Quest 3S** and **PICO 4 Ultra**. Quest 3 and Quest 2 are out. `docs/DEVICE_VALIDATION.md` still names Quest 3 in its Round 2 tables; for this pass, read every "Quest 3" there as Quest 3S.

## 1. Who does what

| Who | Does |
| --- | --- |
| Agent | Builds both stacks, installs over adb, runs `check-overrides.sh`, starts and stops capture, pulls files, fills in numbers from CSVs, traces and logs |
| Mike | Wears the headset, runs each workload, records the headset view, and writes what he sees for every visual row |
| Rule | No visual row (R1.1, R1.2, R1.3 and the Round 2 colour, corner and eviction rows) passes without Mike's capture or written observation. Numbers alone never pass a visual row |

## 2. Stacks

SHAs read on 2026-10-25 with `gh pr view <n> -R mikevocalz/<repo> --json headRefOid` and `gh api repos/mikevocalz/<repo>/commits/main`. If a PR head moves (the §6.2 render-quality commit will move #112 and #113), rebuild Candidate and record the new SHAs in the matrix; never compare against an APK whose SHAs are not in its row.

| Repo | Baseline | Candidate |
| --- | --- | --- |
| virocore | `main` `f5c2a7289c1665ec83740339ddc4464680d31d6b` (before #112) | #113 `b73d91962dbe97c9ccd31f4d18df932fd1c2e296`, built on #112 `70e95fd8c13b8209d70a792a1ae4e7741102da96` |
| viro (mikevocalz fork) | `main` `99b1d87c55ca9f43a6452144183a0b32a2bfb3c9` | #70 `fa238896674c743db1719e4ad03882725ca4a29b`, on #69 `fe417ad87c76b5643d74d0b51881ab926865b47f` |
| viro-external | `main` `bbd4c617c4e98c2edfe2e55aed65bab867fa18c5` | #73 `30a2848cd44c394e8ebb6168028e32235080df8b`, on #72 `7e962577c612042a27235a213f2a02d8632c9d59` |
| rive-runtime | none (Baseline has no Rive runtime) | `8b3ca41b12bfd8ac9454444102c1fb130b3e7e11` (virocore `android/rive/RIVE_RUNTIME_COMMIT`) |
| MoyoLearn (consumer app) | `a6afe6593060b73c8fc7b61d2ee0e0800204f1f3` | same commit |

What differs between the stacks for every app, flags off (from the prompt §2, checked against the virocore source at the SHAs above):

| Setting | Baseline (`f5c2a728`) | Candidate (`b73d919`) |
| --- | --- | --- |
| Eye-buffer size | runtime's recommended size | 1.3 × recommended per axis, clamped to max (`VROSceneRendererOpenXR.cpp:1047-1051`) |
| Default foveation | MEDIUM, dynamic (`:1062`) | LOW, dynamic (`:1085`) |
| Eye-buffer log line | `Eye %u: swapchain ...` at VERBOSE only (`:1054`) | `Eye %u: recommended %ux%u, max %ux%u, rendering %ux%u` at INFO (`:1052`) |

## 3. Builds

### How MoyoLearn consumes Viro (read at `a6afe659`)

- `@reactvision/react-viro` comes from `vendors/reactvision-react-viro-3.0.1-moyo.1.tgz` through a root `pnpm.overrides` entry, plus `patches/@reactvision__react-viro@3.0.1-moyo.1.patch`. The patch's only Android hunk rewrites `android/viro_renderer/build.gradle` line 20 to `api files(rootProject.findProperty('moyoViroRendererAar') ?: 'viro_renderer-release.aar')`.
- `apps/mobile/android/build.gradle:59-71` sets `ext.moyoViroRendererAar` to `vendors/viro-renderer-034d3b9.aar` and fails the build unless its SHA-256 is `08c22843…506a3b`. So `libviro_renderer.so` in the APK comes from that vendored AAR, not from the react-viro tarball's `viro_renderer-release.aar`.
- There is no `VIROCORE_LIB_DIR` and no app CMake that imports `libviro_renderer.so` (searched `apps/mobile/android` and every `CMakeLists.txt`/`build.gradle` in `node_modules`). The stale-`.so` trap in decax9 does not apply here, but the vendored-AAR pin is the same trap in another form: swapping the viro checkout alone changes nothing native.
- `@viro-external/{core,media,ui,xr-contract}` come from `vendors/viro-external-*.tgz` overrides. The app does not depend on `@viro-external/native-panels` or `@viro-external/spatial-panels`.
- Flavors (`apps/mobile/android/app/build.gradle:93-111`): one dimension `device`; `quest` and `pico` are `arm64-v8a` only. All flavors keep `applicationId com.moyolearn.app`.
- Signing (`:128-151`): `release` uses `signingConfigs.debug` with the committed `app/debug.keystore`. No secret is needed, and Baseline and Candidate share one signature, so `adb install -r` swaps them in place.
- `android/` is committed, so there is no prebuild step.

### `scripts/device/build-stack.sh`

```sh
scripts/device/build-stack.sh baseline quest
scripts/device/build-stack.sh candidate quest
scripts/device/build-stack.sh baseline pico
scripts/device/build-stack.sh candidate pico
```

For each stack the script:

1. Clones virocore, viro, viro-external and MoyoLearn at the SHAs above into `$WORK_DIR/<stack>/` (default `~/viro-device-builds`). Your own checkouts are never touched, so a dirty virocore tree cannot leak into a build.
2. Builds the renderer AAR from the clean virocore clone: `scripts/build-rive-runtime.sh` (Candidate only; needs network on first run), then `cd android && ./gradlew :viroreact:assembleRelease --no-daemon`.
3. Builds and packs viro (`npm install --ignore-scripts && npm run build && npm pack`), and packs the four viro-external packages the app uses (`pnpm pack`).
4. Installs MoyoLearn exactly as committed (`pnpm install --frozen-lockfile`), then overlays the packed viro and viro-external package bodies into `node_modules`, keeping the app's patched `viro_renderer/build.gradle` line.
5. Replaces `vendors/viro-renderer-034d3b9.aar` with the stack's renderer AAR and updates the pinned SHA-256 in `apps/mobile/android/build.gradle`. The diff is saved as `app-<platform>-gradle.diff`.
6. Runs `ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a ./gradlew :app:assemble{Quest,Pico}Release --no-daemon` and records the real exit code.
7. Verifies the APK: the GNU build ID of `lib/arm64-v8a/libviro_renderer.so` inside the APK must equal the build ID of the `.so` in the renderer AAR it just built (build IDs survive AGP's strip; raw SHA-256 may not). As a second check, the `Eye %u: recommended` format string must be present in a Candidate APK and absent in a Baseline APK.
8. Writes `build-<platform>.txt` with every SHA, the renderer AAR SHA-256, the APK and AAR `.so` SHA-256 and build IDs, and the APK SHA-256.

Known risks the script cannot settle:

- The app commit was written against react-viro `3.0.1-moyo.1`; Baseline viro is `3.0.2-moyo.2` and Candidate is `3.0.3-moyo.1`. The overlay keeps the app's lockfile, so any new dependency those versions need is missing. A JS bundle error at build or launch is a finding for the build plan, not for #112.
- Baseline pairs the viro fork's committed `react_viro-release.aar` at `99b1d87c` with a renderer built from virocore `f5c2a728`. That pairing has not been built before; a JNI mismatch shows up as `UnsatisfiedLinkError` at launch.
- `MIN_FREE_GB=25` is a margin I set, not a measured footprint.

### Build attempt, 2026-10-25

One Candidate `questRelease` attempt, run as `scripts/device/build-stack.sh candidate quest`:

```text
build-stack: only 0 GiB free under /Users/mikevocalz; need 25. Free space first.
```

`df -h /System/Volumes/Data` at the same time: 460 GiB volume, 415 GiB used, 240 MiB available, 100%. A release build of this app plus a virocore build needs several GiB, so the build did not start. **No APK exists for either stack.** Free disk space, then run the four commands above.

## 4. Capture scripts

| Script | What it does |
| --- | --- |
| `install.sh <apk> [--clean]` | `adb install -r` (or uninstall first with `--clean`), refuses a `mobile` APK or a flavor/headset mismatch, records OS and runtime properties and package versions, and checks the on-device APK SHA-256 against the local file |
| `check-overrides.sh [file]` | Exit 0 clean, 1 override active (run void), 2 PICO Performance Tuner unconfirmed, 3 setup error |
| `capture-start.sh <label>` | Override check, device identity, full logcat, OVR Metrics CSV on Quest, a memory/thermal sampler, optional Perfetto (`PERFETTO=1`) |
| `capture-stop.sh` | Stops everything, pulls the OVR Metrics CSV and the trace, and extracts the eye-buffer, refresh-rate, Rive, compositor, whiteboard and crash lines |
| `perfetto-vr.pbtx` | Perfetto config: sched, CPU and GPU frequency, thermal, atrace `gfx`/`view`, process and memory stats, `gpu.renderstages`, `gpu.counters` |

Runs land in `~/viro-device-runs/<UTC stamp>-<label>/`. Captures are not committed; link them from the matrix by run directory name.

### OS and runtime identity

| Device | Property or source | Status |
| --- | --- | --- |
| Quest | `ro.vros.build.version` | Documented on Meta's native SDK project setup page (developers.meta.com/vr/documentation/native/metavr-os-nsdk/metavr-os-nsdk-project-setup/). Output format not confirmed on a headset |
| Both | `ro.build.fingerprint`, `ro.build.version.incremental`, `ro.build.display.id` | Stock Android; recorded as printed |
| PICO | `ro.pvr.internal.version` | From the legacy PICO ADB guide (Neo 3 era, sdk.picovr.com/docs/ADBCommand/chapter_two.html). Not confirmed on PICO 4 Ultra |
| Both | `versionName` of every package matching `openxr`, `runtime`, `systemdriver`, `vrdriver`, `vrshell`, `pxr`, `pvr` | Recorded by `install.sh`; which package is the OpenXR runtime is read off the list on the first session |

### Overrides that void a run

- Quest, read with `getprop`: `debug.oculus.refreshRate`, `textureWidth`, `textureHeight`, `cpuLevel`, `gpuLevel`, `foveation.dynamic` (Meta, "System properties", developers.meta.com/horizon/documentation/spatial-sdk/ts-systemproperties/), and `foveation.level`, `foveation.subsampled`, `gfr.mode`, `dynResScaler`, `forceSpaceWarp`, `swapInterval`, `eyeFov*` (Meta, MQDH media and VrRuntime debugging table, developers.meta.com/horizon/documentation/unity/ts-mqdh-media/). Meta: "Changes to system properties do not persist over reboots." Reboot before a session to start clean.
- PICO: the Performance Tuner (Settings > Developer, PICO 4 Ultra OS 5.13.0 and later) sets refresh rate, eye-buffer resolution, CPU and GPU level and FFR per app (PICO community release notes and newsroom; no developer doc page found). No property exposes its state, so Mike confirms by hand that the app has no profile and the script records `PERF_TUNER_OFF=yes`. The legacy `persist.pvr.config.target_fps` and `eyebuffer_width/height` properties are checked too.
- Third-party optimizers on Quest (for example SideQuest tools) work through the same `debug.oculus.*` properties, so the property check covers them.

## 5. Refresh-rate request: API gap

ViroCore has no way to request a refresh rate. At both `f5c2a728` (`VROSceneRendererOpenXR.cpp:1149-1178`) and `b73d919` (`:1172-1201`) it loads `xrEnumerateDisplayRefreshRatesFB` and `xrGetDisplayRefreshRateFB` only, with the comment "Read-only: enumerate + current. Never xrRequestDisplayRefreshRateFB". It logs every available rate (`[XR-DIAG] display refresh rate: %.2f Hz`) and the current one (`... current: %.2f Hz`), so the runtime default and the highest available rate are recorded on every run without a request.

Consequences for R1.4:

- Every cell runs at the runtime default rate. Meta lists 72 Hz as the default for `debug.oculus.refreshRate` and 72, 80, 90 and 120 Hz as the Quest 3S rates (System properties page above). PICO 4 Ultra's rates are read from the `[XR-DIAG]` lines on the first session.
- The "highest available" cells are **blocked**. `debug.oculus.refreshRate` could force 120 Hz on Quest, but it is one of the overrides that void a run under §6.4. Adding a request API is out of scope unless approved. Mike decides: approve a request API, approve a labelled setprop run (Quest only; PICO would need the Performance Tuner, which is also an override), or drop those cells.

## 6. Round 1: flags off (`nativeBoard` and `nativeRive` off)

Columns for every row: SHAs (virocore / viro / viro-external / app), device, OS/runtime, refresh, eye-buffer scale, foveation, build mode, workload, duration, numbers, capture links. "Scale" and "foveation" are what the eye-buffer log line and OVR Metrics `EB W`/`EB H`/`FOV` (PICO HUD `EBW`/`EBH`/`FRL`) report, not what the build intended.

### Workload sources in MoyoLearn `a6afe659`

| Row | Workload | Status |
| --- | --- | --- |
| R1.1 | Three scenes: `moyo://xr-layout-probe` (stacked-quad panels, `packages/ui/xr`), `moyo://xr-question-probe` (`ViroRivePanel` question panel), `moyo://rive-panel-probe` (`ViroRivePanel`, an external surface per #112 commit `52b3773`). The tutor XR screen (`packages/app/features/tutor/tutor-xr-screen.native.tsx`) is the alternative if a probe does not enter the immersive scene | Routes exist; whether each opens the immersive scene is confirmed on the first session |
| R1.2 | A clip with a near-black ramp, mid-grey and skin tones | **Blocked**: no `ViroVideo` scene in MoyoLearn and no test clip. Needs an app-side probe route and a clip, built identically for both stacks |
| R1.3 | A panel at 0.9 opacity with anti-aliased text over passthrough | `rive-panel-probe` takes an `opacity` prop that drives `uiOpacity` (`apps/mobile/src/native-3d/rive-panel-probe.tsx:15,56`); whether the route can set 0.9 without a code change is confirmed on the first session |
| R1.4 | The R1.1 scene with the heaviest GPU load, chosen on the first session and kept for every cell | Ready once APKs exist |
| R1.5 | 1, 2 and 4 simultaneous video or external surfaces | **Blocked**: needs a probe that mounts N `ViroRivePanel`s or videos; same app-change decision as R1.2 |
| R1.6 | Any R1.1 scene, 10 cycles of background/resume and headset off/on | Ready once APKs exist |

### R1.1 to R1.3, R1.5, R1.6

| Row | Stack | Device | SHAs (vc / viro / vx / app) | OS/runtime | Refresh | Scale | Foveation | Build | Workload | Duration | Numbers | Captures | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1.1 Existing scenes | Baseline | Quest 3S | f5c2a728 / 99b1d87c / bbd4c617 / a6afe659 | not yet run | default | not yet run | not yet run | questRelease | 3 scenes | not yet run | n/a | not yet run | not yet run |
| R1.1 Existing scenes | Candidate | Quest 3S | b73d9196 / fa238896 / 30a2848c / a6afe659 | not yet run | default | not yet run | not yet run | questRelease | 3 scenes | not yet run | n/a | not yet run | not yet run |
| R1.1 Existing scenes | Baseline | PICO 4 Ultra | f5c2a728 / 99b1d87c / bbd4c617 / a6afe659 | not yet run | default | not yet run | not yet run | picoRelease | 3 scenes | not yet run | n/a | not yet run | not yet run |
| R1.1 Existing scenes | Candidate | PICO 4 Ultra | b73d9196 / fa238896 / 30a2848c / a6afe659 | not yet run | default | not yet run | not yet run | picoRelease | 3 scenes | not yet run | n/a | not yet run | not yet run |
| R1.2 Video | Baseline | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | clip (blocked) | not yet run | lifted/crushed blacks: not yet run | not yet run | not yet run |
| R1.2 Video | Candidate | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | clip (blocked) | not yet run | lifted/crushed blacks: not yet run | not yet run | not yet run |
| R1.2 Video | Baseline | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | clip (blocked) | not yet run | lifted/crushed blacks: not yet run | not yet run | not yet run |
| R1.2 Video | Candidate | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | clip (blocked) | not yet run | lifted/crushed blacks: not yet run | not yet run | not yet run |
| R1.3 Passthrough | Baseline | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | 0.9 panel + AA text | not yet run | panel strength, edge quality: not yet run | not yet run | not yet run |
| R1.3 Passthrough | Candidate | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | 0.9 panel + AA text | not yet run | panel strength, edge quality: not yet run | not yet run | not yet run |
| R1.3 Passthrough | Baseline | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | 0.9 panel + AA text | not yet run | panel strength, edge quality: not yet run | not yet run | not yet run |
| R1.3 Passthrough | Candidate | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | 0.9 panel + AA text | not yet run | panel strength, edge quality: not yet run | not yet run | not yet run |
| R1.5 Memory, 1/2/4 surfaces | Baseline | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | N surfaces (blocked) | not yet run | RSS, MemAvailable: not yet run | not yet run | not yet run |
| R1.5 Memory, 1/2/4 surfaces | Candidate | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | N surfaces (blocked) | not yet run | RSS, MemAvailable: not yet run | not yet run | not yet run |
| R1.5 Memory, 1/2/4 surfaces | Baseline | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | N surfaces (blocked) | not yet run | RSS, MemAvailable: not yet run | not yet run | not yet run |
| R1.5 Memory, 1/2/4 surfaces | Candidate | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | N surfaces (blocked) | not yet run | RSS, MemAvailable: not yet run | not yet run | not yet run |
| R1.6 Lifecycle, 10 cycles | Baseline | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | bg/resume + off/on | not yet run | crashes, RSS growth: not yet run | not yet run | not yet run |
| R1.6 Lifecycle, 10 cycles | Candidate | Quest 3S | as R1.1 | not yet run | default | not yet run | not yet run | questRelease | bg/resume + off/on | not yet run | crashes, RSS growth: not yet run | not yet run | not yet run |
| R1.6 Lifecycle, 10 cycles | Baseline | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | bg/resume + off/on | not yet run | crashes, RSS growth: not yet run | not yet run | not yet run |
| R1.6 Lifecycle, 10 cycles | Candidate | PICO 4 Ultra | as R1.1 | not yet run | default | not yet run | not yet run | picoRelease | bg/resume + off/on | not yet run | crashes, RSS growth: not yet run | not yet run | not yet run |

### R1.4 Performance

Each device at the runtime default refresh rate and the highest available, eye-buffer scale 1.0 vs 1.3, foveation LOW vs MEDIUM, 10-minute soak per cell. Evidence: p50/p95 APP T, GPU U, stale frames, FPS, thermal behaviour, logged eye-buffer sizes. Numbers go in [PERFORMANCE.md](PERFORMANCE.md); this table tracks which cells ran.

Baseline has no scale or foveation setting: it always renders at scale 1.0 with MEDIUM dynamic foveation. Candidate is fixed at 1.3 with LOW dynamic foveation until the §6.2 render-quality setting lands; until then only the "1.3 / LOW" Candidate cells can run. The viro bridge has no JS foveation API at `fa238896` (no `setFoveation` in `android/viro_bridge` or `components`), and virocore's `Renderer.setFoveationLevel` (`Renderer.java:215`, `b73d919`) has no caller from the app.

| Device | Refresh | Stack | Scale | Foveation | Soak | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Quest 3S | default | Baseline | 1.0 | MEDIUM dyn | 10 min | not yet run |
| Quest 3S | default | Candidate | 1.0 | LOW dyn | 10 min | not yet run (needs §6.2) |
| Quest 3S | default | Candidate | 1.0 | MEDIUM dyn | 10 min | not yet run (needs §6.2) |
| Quest 3S | default | Candidate | 1.3 | LOW dyn | 10 min | not yet run |
| Quest 3S | default | Candidate | 1.3 | MEDIUM dyn | 10 min | not yet run (needs §6.2) |
| Quest 3S | highest | Baseline | 1.0 | MEDIUM dyn | 10 min | blocked (§5) |
| Quest 3S | highest | Candidate | 1.0 | LOW dyn | 10 min | blocked (§5, §6.2) |
| Quest 3S | highest | Candidate | 1.0 | MEDIUM dyn | 10 min | blocked (§5, §6.2) |
| Quest 3S | highest | Candidate | 1.3 | LOW dyn | 10 min | blocked (§5) |
| Quest 3S | highest | Candidate | 1.3 | MEDIUM dyn | 10 min | blocked (§5, §6.2) |
| PICO 4 Ultra | default | Baseline | 1.0 | MEDIUM dyn | 10 min | not yet run |
| PICO 4 Ultra | default | Candidate | 1.0 | LOW dyn | 10 min | not yet run (needs §6.2) |
| PICO 4 Ultra | default | Candidate | 1.0 | MEDIUM dyn | 10 min | not yet run (needs §6.2) |
| PICO 4 Ultra | default | Candidate | 1.3 | LOW dyn | 10 min | not yet run |
| PICO 4 Ultra | default | Candidate | 1.3 | MEDIUM dyn | 10 min | not yet run (needs §6.2) |
| PICO 4 Ultra | highest | Baseline | 1.0 | MEDIUM dyn | 10 min | blocked (§5) |
| PICO 4 Ultra | highest | Candidate | 1.0 | LOW dyn | 10 min | blocked (§5, §6.2) |
| PICO 4 Ultra | highest | Candidate | 1.0 | MEDIUM dyn | 10 min | blocked (§5, §6.2) |
| PICO 4 Ultra | highest | Candidate | 1.3 | LOW dyn | 10 min | blocked (§5) |
| PICO 4 Ultra | highest | Candidate | 1.3 | MEDIUM dyn | 10 min | blocked (§5, §6.2) |

## 7. Round 2: flags on (`nativeBoard` and `nativeRive` on)

Round 2 follows [`docs/DEVICE_VALIDATION.md`](../DEVICE_VALIDATION.md) as written (rows W1-W9, R1-R11, C1-C2, X1-X9, panel sizing), on Candidate only, Quest 3S and PICO 4 Ultra.

Round 2 cannot run on MoyoLearn `a6afe659` as it stands: the app does not depend on `@viro-external/native-panels` or `@viro-external/spatial-panels`, so neither flag exists in the build. Round 2 needs an app commit that adds them; that is a second consumer-app commit and is recorded as such in every Round 2 row.

| Row | Source | Covers prompt bullet | Quest 3S | PICO 4 Ultra | Gap found while preparing |
| --- | --- | --- | --- | --- | --- |
| W1-W9 Whiteboard | DEVICE_VALIDATION §4.1 | ink latency (where instrumented), local and remote edits on one document | not yet run | not yet run | §4.1 has no remote-edit row; add a run where a second client edits the same document while Mike draws. Ink latency has no instrumentation in the source read here; record "not instrumented" rather than a number |
| R1-R11 Native Rive | DEVICE_VALIDATION §4.2 | Rive mid-grey and 50%-alpha swatch over passthrough matching the Rive editor, no corner halo (R2) | not yet run | not yet run | Capture the same `.riv` open in the Rive editor beside the headset capture |
| R3 Rive rendering mode | DEVICE_VALIDATION §4.2 R3 | the Rive rendering mode logged on each headset | not yet run | not yet run | **No log line at `b73d919` prints the Rive mode.** The Rive-side lines are `EGL ready…` (`VRORivePanelEGL.cpp:194`) and `finish pass ready: %s output…` (`VROOpenXRRivePanelProducer.cpp:69`); neither names interlock, atomic, MSAA or clockwise. R3 cannot pass until a log of the selected mode is added |
| C1-C2 Corners | DEVICE_VALIDATION §4.3 | identical corners on quad, cylinder, canvas panel and scene fallback; pointer hits in transparent corners ignored | not yet run | not yet run | C1 covers quad, cylinder and scene panel; add the canvas panel (viro #70) to the same side-by-side. Corner hits are W3 and R6 |
| X5 Eviction | DEVICE_VALIDATION §4.4 | forced layer-budget eviction falling back with identical pixels and corners | not yet run | not yet run | `[XR-PANEL] compositor maxLayers=%u` (`VROSceneRendererOpenXR.cpp:538`) gives the budget; `compositor panel %s: %s (%s)` (`:1819`) logs each presentation change |
| X6, X8, R7 Lifecycle | DEVICE_VALIDATION §4.4, §4.2 | session STOPPING, app reload and background/resume with swapchain and surface counts back to baseline | not yet run | not yet run | X6 says the swapchain-count log does not exist yet; it is still missing at `b73d919`. Without it, counts come from Perfetto or `dumpsys`, not a log line |

## 8. Gates and open decisions for Mike

1. Free disk space so the four builds can run (§3).
2. Refresh-rate cells: approve a request API, approve a labelled setprop run, or drop the "highest" cells (§5).
3. R1.2 and R1.5 need an app-side probe route and a test clip, added in one app commit used by both stacks.
4. Round 2 needs an app commit that adds `@viro-external/native-panels` and `@viro-external/spatial-panels`.
5. R3 needs a Rive-mode log line in virocore before it can pass.
