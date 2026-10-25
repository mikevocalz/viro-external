# Device validation: native whiteboard, native Rive, rounded panels

[Handbook](README.md) · [Performance](PERFORMANCE.md) · [API](API_WHITEBOARD_RIVE_PANELS.md) · [ADR 0001](adr/0001-native-whiteboard-rive-panels.md)

This is the V1 lane procedure (`prompts/ROSTER.md`). It lists every check that the source, the host tests and the compilers cannot settle and that needs a Quest 3S and a PICO 4 Ultra, the supported headsets decided on 2026-10-25. Until a row below has a recorded result, that feature is unverified on that headset. A passing typecheck, a non-null handle or a rising frame counter does not pass a row (`ROSTER.md` rule 5); a capture or a log line does.

Every result table on this page says **not yet run**.

## 1. Build

### Flavors

The consuming app is MoyoLearn. Its `apps/mobile/android/app/build.gradle` (read at `cd2c3197`) declares one flavor dimension, `device`, with three flavors:

| Flavor | `minSdkVersion` | `targetSdkVersion` | ABI filter | Install on |
| --- | --- | --- | --- | --- |
| `quest` | 29 | 34 | `arm64-v8a` | Quest 3S only |
| `pico` | 32 | 34 | `arm64-v8a` | PICO 4 Ultra only |
| `mobile` | app default | app default | none | phones; never a headset |

Build types are `debug` and `release`; both are signed with the debug keystore in that file, so `release` installs without extra signing.

Rules:

- On a headset, install only `questDebug`/`questRelease` (Quest) or `picoDebug`/`picoRelease` (PICO). `./gradlew assembleDebug` builds every flavor, `mobileDebug` included; never install `mobileDebug` or `mobileRelease` on a headset. The expo-horizon guidance says the same in reverse: quest variants must not run on phones.
- Use `*Debug` for the functional checks below and `*Release` for timing in [performance](PERFORMANCE.md).
- Both headset flavors filter to `arm64-v8a`, which is the only ABI where `RivePanel.isAvailable` can be true.
- After any change to the `expo-horizon-core` plugin options, run `npx expo prebuild --clean` before building; the plugin writes native files at prebuild time.

### Commands

From `MoyoLearn/apps/mobile`, with one headset connected (`adb devices` shows one serial):

```sh
adb -s "$SERIAL" uninstall com.moyolearn.app || true   # never test over an older install
cd android
ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a ./gradlew :app:assembleQuestDebug --no-daemon
echo "exit=$?"                                       # record the real exit code
adb -s "$SERIAL" install -r app/build/outputs/apk/quest/debug/app-quest-debug.apk
```

For PICO, replace `Quest` with `Pico` and `quest` with `pico`. Check the APK path Gradle prints rather than assuming it.

### Quest panel sizing (expo-horizon)

MoyoLearn's `app.config.ts` configures `expo-horizon-core` with `supportedDevices: 'quest2|questpro|quest3|quest3s'`, `defaultWidth: '1024dp'`, `defaultHeight: '640dp'` and `disableVrHeadtracking: false`. This sizes the app's 2D panel on Horizon OS before it enters the immersive Viro scene; it does not size the Viro scene panels, which are set in meters in code.

Checks for each Quest run:

- The 2D panel opens at 1024 x 640 dp (16:10, the same aspect as the board) and is not letterboxed. Meta's panel-sizing guidance: https://developers.meta.com/horizon/documentation/android-apps/panel-sizing
- `orientation` in `app.config.ts` is `'default'`. expo-horizon's guidance is to match orientation to the panel size (`landscape` for a wide panel). Record whether the panel opens landscape with `'default'`; if not, that is a finding for the app, not for these packages.
- `supportedDevices` is required for Horizon Store submission and lists `quest3`.

PICO does not use expo-horizon. MoyoLearn configures it through `@expo-pico/core` (`app.config.ts`, the PICO block), which this procedure does not change.

## 2. What to record for every run

Fill one block per headset per run. A result without these fields is not accepted.

| Field | How to get it |
| --- | --- |
| viro-external commit | `git -C viro-external rev-parse HEAD` |
| viro commit | `git -C viro rev-parse HEAD` (branch `feat/canvas-surfaces-registry`; `f5d93c23` when this page was written) |
| virocore commit in the renderer AAR | from the viro commit message that rebuilt `android/viro_renderer/viro_renderer-release.aar` (`d5e219c1` for `e41d43b8`, `48ed1ffc` for `f5d93c23`) |
| rive-runtime commit | virocore `android/rive/RIVE_RUNTIME_COMMIT` (`8b3ca41b12bfd8ac9454444102c1fb130b3e7e11`) |
| Vendored header check | `VIROCORE_ROOT=/path/to/virocore pnpm --filter @viro-external/native-panels test` passes against the virocore commit above |
| Nitro version | `react-native-nitro-modules` and `nitrogen` in the app lockfile (native-panels pins `1.0.0-alpha.nightly.100.g107f6fc66597`) |
| MoyoLearn commit and dirty state | `git -C MoyoLearn rev-parse HEAD; git -C MoyoLearn status --short` |
| Variant | `questDebug`, `questRelease`, `picoDebug` or `picoRelease` |
| Flags | `nativeBoard` and `nativeRive` values for the run |
| Headset and OS build | `adb shell getprop ro.product.model`, `adb shell getprop ro.build.fingerprint` |
| Refresh rate | as reported by the runtime during the run (OVR Metrics Tool on Quest, PICO's overlay) |
| Workload | board snapshot file, `.riv` file and its artboard/state machine |
| Evidence | capture file names, logcat file, Perfetto trace |

Log tags to capture: `adb logcat -s WhiteboardRenderer NativePanelsRive` plus Viro's own tags, with `-v threadtime`.

## 3. Flags and rollback

| Flag | Where | Default | On | Rollback |
| --- | --- | --- | --- | --- |
| `nativeBoard` | `QuickDrawNativeBoard` (`packages/ui/src/quickdraw-input/QuickDrawNativeBoard.types.ts:70`) | `false` | native board, WebView board as fallback when unavailable or failed | set `false`; the WebView board renders and the Store, held by the session, is untouched |
| `nativeRive` | `ViroNativeRivePanel` (`packages/native-panels/src/rive/ViroNativeRivePanelProps.ts:24`) | `false` | `VRORivePanel` through `RivePanel` | set `false`; `ViroRivePanel` renders with the same props |

Run every section twice where it applies: flag on, then flag off, to confirm the fallback still works on the same build.

## 4. Checks

Each row: what to do, what passes, what fails. Source is where the check comes from.

### 4.1 Whiteboard (`nativeBoard` on)

| # | Check | Pass | Fail | Source |
| --- | --- | --- | --- | --- |
| W1 | Draw a pen stroke, add a text object, insert an image | All three visible on the paper and editable (select, move, undo) | Any missing, or visible only after a remount | Master prompt §12 |
| W2 | Stroke-start offset: start a stroke with a controller ray, measure ink displacement at the first point against the ray hit | Offset recorded in mm at the board distance; reviewers accept it or it gets a fix | Not measured | `QuickDrawSpatialSurface.md` "What is not verified"; ViroCore samples the drag start on the first drag frame |
| W3 | Corner hits at the board's real distance (2.6 m): aim into each transparent corner, then just inside the rounded edge | Corner rays draw nothing; just-inside rays draw | Ink in a transparent corner, or no ink just inside | `QuickDrawSpatialSurface.md`; panel-tokens rule 4 |
| W4 | Grip-only move: drag across the paper, then drag the grip below it | Paper drag draws and never moves the board; grip drag moves it and cancels any live stroke first | Board moves while drawing, or a stroke continues during a grip drag | `QuickDrawNativeBoard.tsx:26-28` |
| W5 | Background and resume mid-stroke | Stroke cancelled on background; document intact on resume; board redraws | Lost records, duplicated history, blank paper | `QuickDrawSpatialSurface.md` "Capture, cancel and arbitration" |
| W6 | Force a Surface loss (material swap or remount) | State goes `suspended` or `lost` then `active`; the same document reappears | Blank paper after the Surface returns | `WhiteboardRendererState.ts` |
| W7 | Idle board for 10 s | 0 buffers queued by the `WhiteboardRenderer-<id>` thread | Any buffer queued with no change | [Performance](PERFORMANCE.md), procedure 3 |
| W8 | Highlighter over ink | Highlighter composites with `multiply`, matching the web board | Opaque or wrong blend | panel-tokens "Alpha and transfer handling"; needs API 29 |
| W9 | Flag off | WebView board renders, same document | Crash or empty board | ADR D1 |

### 4.2 Native Rive, route B1 (`nativeRive` on)

| # | Check | Pass | Fail | Source |
| --- | --- | --- | --- | --- |
| R1 | First frame of `moyo_board_chrome.riv` through CanvasSourceBridge with a `PremultiplyAlpha` material | The artboard renders, state goes `active` | No frame, `lost`, or a material error | virocore `RIVE_RUNTIME.md` "Needs a device" |
| R2 | Colour gate: mid-grey swatch and 50 % alpha swatch over passthrough, then each corner close up at 0°, 30° and 60° off-axis | Swatches match the token; no light or dark halo on the rounded edge | Any halo, or swatches off from the token | virocore `RIVE_RUNTIME.md`; panel-tokens "Colour gate"; critique round 1 items 2, 3, 14 |
| R3 | Interlock mode: log which mode Rive selects on Adreno and whether FBO 0 renders directly or through the offscreen blit | The log line is captured on each headset and the mode is written in the results table | Mode not recorded | virocore `RIVE_RUNTIME.md`; master prompt §12 |
| R4 | Settled state machine for 10 s | 0 `eglSwapBuffers` (0 `queueBuffer` slices on the worker) | Any swap while settled | virocore `RIVE_RUNTIME.md` |
| R5 | Orientation | Panel upright, not mirrored vertically | Flipped | virocore `RIVE_RUNTIME.md` ("Rows" note) |
| R6 | Pointer hits on BoardChrome keys at the panel's edges and corners with `contain` fit, from the board input router | Each key reacts where it is drawn; presses starting in a transparent corner do nothing; a press that started inside keeps its release even in a corner | Offset hits, dead keys, corner presses reaching Rive | virocore `RIVE_RUNTIME.md` "Input"; `RivePanel.nitro.ts:62-71` |
| R7 | `surfaceLost()` then `SurfaceTexture.release()` (unmount, or background) and remount | No `EGL_BAD_NATIVE_WINDOW` in logcat; after `attachSurface()` the same artboard state and view-model values | EGL errors, or state reset | virocore `RIVE_RUNTIME.md` |
| R8 | Bindings: change `tool`, `canUndo`, `status` from the app | One `applyUpdate` per change; panel reflects each | Values lost or late by more than a frame | `ViroNativeRivePanel.tsx:80-94` |
| R9 | Rive frame time per frame, against the `TextureRenderTargetGL` + blit alternative | Numbers recorded per [performance](PERFORMANCE.md), procedure 2 | Not recorded | virocore `RIVE_RUNTIME.md` |
| R10 | No duplicate Rive symbols with `@rive-app/react-native` installed in the same app | App links and runs both | Symbol clash at load | Master prompt §14 "Native packaging"; virocore "Symbol visibility" |
| R11 | Flag off | `ViroRivePanel` renders the same file | Crash or blank | ADR D3 |

### 4.3 Rounded corners on every route

| # | Check | Pass | Fail | Source |
| --- | --- | --- | --- | --- |
| C1 | Same token on the board (scene panel), the Rive strip (scene panel) and, once B2 has a host, a quad and a cylinder layer | Corners look the same angle at each panel's distance | Visibly different rounding | Master prompt §14 "Rounded corners"; panel-tokens §1 |
| C2 | Cylinder corners at grazing angles | Corners follow the arc with no halo | Straight-edged or haloed corners | virocore `OPENXR_PANEL_COMPOSITOR.md` checklist |

### 4.4 Compositor route B2

These need a host that calls `addRiveCompositorPanel`. The engine and its Java API exist (virocore `d5e219c1`, `48ed1ffc`); the host is `@viro-external/spatial-panels` (`createSpatialPanelsHost`, `CompositorPanelFallback`) on this branch. Build the app with that package and the renderer from viro `fa238896` or later.

| # | Check | Pass | Fail | Source |
| --- | --- | --- | --- | --- |
| X1 | Both runtimes accept a Rive worker context that shares the XR context with a different config | Panel reaches `Compositor` presentation on Quest and PICO | Context creation fails on either | virocore `RIVE_RUNTIME.md` |
| X2 | First frame on an sRGB swapchain and on an RGBA8 swapchain, with the colour gate (R2) | Both pass the swatch gate | Double encoding (washed out) or dark fringes | `OPENXR_PANEL_COMPOSITOR.md` "Colour and alpha" |
| X3 | Upright orientation of the ring copy | Upright | Flipped | virocore `RIVE_RUNTIME.md` |
| X4 | Settled state machine for 10 s | 0 producer calls | Any call while settled | `OPENXR_PANEL_COMPOSITOR.md` checklist |
| X5 | Eviction: exceed the layer budget, then force `XR_ERROR_LAYER_LIMIT_EXCEEDED` | Panel switches to the scene fallback quad with identical pixels and corners (side-by-side capture) and returns to `Compositor` when a slot frees | Visible jump, missing panel, or different corners | `OPENXR_PANEL_COMPOSITOR.md` "Eviction"; master prompt §14; critique item 9 |
| X6 | Swapchain leak count: log the number of live panel swapchains at baseline, then after 5 JS reloads and 5 background/resume cycles | Count returns to baseline after each | Count grows | Master prompt §14 "Compositor". No such log exists yet; add it at `xrCreateSwapchain`/`xrDestroySwapchain` before running |
| X7 | `removeCompositorPanel` then `dispose()` | No GL errors in logcat | Any GL error | virocore `RIVE_RUNTIME.md` |
| X8 | Session STOPPING and session loss (take the headset off; force a runtime restart) | No crash, no GL call without a current context, panels return after resume | Crash, hang, or leaked panels | `OPENXR_PANEL_COMPOSITOR.md` "Important limits": not yet demonstrated |
| X9 | Finish-pass GPU time | Recorded per [performance](PERFORMANCE.md) | Not recorded | virocore `RIVE_RUNTIME.md` |

### 4.5 Input path outside Quest and PICO

| # | Check | Pass | Fail | Source |
| --- | --- | --- | --- | --- |
| I1 | Muse pen position frame on visionOS: draw at the four paper corners | Ink lands under the pen tip (the input router assumes Viro world meters) | Systematic offset or scale | `QuickDrawSpatialSurface.md` "What is not verified" |

I1 tests the shared JS input router with the WebView board, since neither native producer exists on visionOS.

## 5. Results

### Quest 3S

Run fields (section 2): not yet run.

| Check | Result | Evidence |
| --- | --- | --- |
| W1-W9 | not yet run | |
| R1-R11 | not yet run | |
| R3 interlock mode | not yet run | |
| C1-C2 | not yet run | |
| X1-X9 | not yet run | |
| Panel sizing | not yet run | |

### PICO 4 Ultra

Run fields (section 2): not yet run.

| Check | Result | Evidence |
| --- | --- | --- |
| W1-W9 | not yet run | |
| R1-R11 | not yet run | |
| R3 interlock mode | not yet run | |
| C1-C2 | not yet run | |
| X1-X9 | not yet run | |

### visionOS

| Check | Result | Evidence |
| --- | --- | --- |
| I1 | not yet run | |
