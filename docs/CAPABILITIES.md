# Capability and verification matrix

[Handbook](README.md) · [Compositor implementation inventory](PANELS_STATUS.md)

Baseline inspected: `2331527d50ffda0a8882c6fb832b10895c7c39f4`. **These are source-readiness labels, not a blanket cross-platform certification.** Dates and PR merges alone are not device evidence.

- **Implemented:** source behavior exists; read the evidence column for what was exercised.
- **Requires native host:** reusable API/adapter exists but an application/native renderer must supply the concrete path.
- **Contract/design only:** type/API proposal or intended mapping, not a shipped runtime.
- **Device verified:** reserved for an attached exact-build test record; not inferred from the other labels.

| Feature | Source readiness | Evidence and remaining gate |
| --- | --- | --- |
| Rounded/curved scene-panel backgrounds | Implemented | Source geometry; not independently verified here in browser/headset |
| Captured origin, world slots, nearest-slot snapping | Implemented | World-slot and state tests exist; release/capture and comfort need device evidence |
| Panel pin/close/authored-pose state | Implemented | Per-instance Zustand state; pin changes billboarding, not drag permission |
| Workspace definition, lifecycle and requirements | Implemented | Validator/resolver contract tests; does not create pixels |
| Meta workspace resolver | Implemented planner | Budget/fallback/selection rules; no proof of native promotion |
| Meta window host facade | Requires native host | Actual fork wrapper components/runtime config required; presentation unverified here |
| PICO activity-backed WindowContainer host | Implemented adapter requiring real bridge | Request/close contract tests; accepted request is not presented state |
| Independent PICO subwindows / augment panels | Not implemented by current bridge | Keep scene/inline fallback explicit |
| Per-panel OpenXR quad/cylinder swapchains | Contract/design only for arbitrary content | Scene panels are not compositor layers. Only Rive content has a producer; see the row below |
| Rive compositor panels with scene fallback (`@viro-external/spatial-panels`, ADR 0001 L4) | Source-ready, Android arm64 GLES only; unverified on device | Expo Modules API 2.0 module `ViroSpatialPanels` with a `CompositorPanel` shared object over virocore's `com.viro.core.RiveCompositorPanel` (renderer AAR from virocore `48ed1ffc`). `CompositorPanelFallback` shows a `ViroQuad` (or a cylinder arc `ViroGeometry`) with a `PremultiplyAlpha` material carrying the renderer's fallback texture while the layer is evicted, and hides it on `compositor`. Evidence: 15 node tests of the toggle with a fake native module, kotlinc 2.2.21 compile of the Kotlin without the v2 compiler plugin, virocore release AAR build and host tests. Not built with Gradle, not autolinked in an app, never run on a headset. iOS and visionOS: `isAvailable` is false and creation rejects `COMPOSITOR_UNAVAILABLE` (the compositor is GLES-only in v1) |
| Rive surface factory/native-host adapter | Requires native host | Mock-host contract tests; actual GPU artboard, input and lifetime require native evidence |
| QuickDraw surface and panel integration | Requires native host | `QuickDrawSpatialSurface` mounts any adapter that declares a `QuickDrawSurfaceIdentity` (host, backend, texture owner) and rejects one that pairs the deprecated `renderer: "esiku"` with a non-ESIKU host. No ESIKU host ships here, and MoyoLearn's adapter is a WebView host, so its honest identity is `WEBVIEW_QUICKDRAW_IDENTITY`. Paper input reaches the adapter through `dispatchPointerEvent`/`dispatchPointer`. Evidence: node tests only |
| Board input path (Viro rays and Muse pen to the board, ADR 0001 L5) | Source-ready; unverified on device | `createBoardInputRouter` maps Viro world hits to paper UV and board units through the board's world matrix, with a binary32 port of virocore `VROPanelCoverage.h` for corners. Per-device capture, clamp at the paper edge, deterministic cancel per device. Flat boards only: Viro hit events carry no UV, so curved input throws. Evidence: 34 node tests (mapping, coverage values from virocore's test, capture, cancel isolation, pen pressure) plus red runs; never run against a live Viro scene. Open on device: drag-report offset from the first drag frame, Muse world frame on visionOS, input-to-ink latency |
| `QuickDrawNativeBoard` (native paper behind `nativeBoard`) | Source-ready, default off | Composes a `QuickDrawBoardSession` (Store outside React), the injected `useWhiteboardRenderer` and a host-allocated `canvasSource` material; falls back to the WebView board when off, unavailable or failed. Typecheck and an assignability check against native-panels only; no app or headset run |
| Native whiteboard renderer (`@viro-external/native-panels`, ADR 0001 D2) | Source-ready, Android only; unverified on device | Kotlin draws QuickDraw 0.2.0 records with `lockHardwareCanvas` into the Surface viro's `CanvasSurfaces` registry provides (needs API 29 and a Viro build from `feat/canvas-surfaces-registry`). `useWhiteboardRenderer` sends one coalesced diff per frame. Evidence: 16 node tests with a fake renderer; 45 JUnit tests of geometry, parsing and lifecycle run with a local kotlinc; the whole Android source set compiles with kotlinc 2.2.21. Not built with Gradle or CMake, never run in an app or on a headset. No iOS implementation: `resolveWhiteboardRendererFactory()` returns `undefined` there |
| Native Rive panel (`@viro-external/native-panels`, ADR 0001 route B1) | Source-ready, Android arm64 only, default off; unverified on device | Nitro V1 C++ `RiveFile`, `RivePanel` and `RiveViewModelInstance` call ViroCore's `VRORivePanel` in `libviro_renderer.so`; a Kotlin link moves the `CanvasSurfaces` Surface in and out. `ViroNativeRivePanel` renders `ViroRivePanel` unless `nativeRive` is true; rollback is the flag. Evidence: NDK clang compiles all C++ for arm64, the 18 `VRORivePanel` symbols referenced resolve against the shipped arm64 `.so`, a host C++ test, kotlinc compile of the Kotlin link, 15 node tests. Not built with Gradle or CMake, not linked, never run in an app or on a headset. Gaps: enum/color bindings, `init`/`input` props, iOS |
| Glasses UI components | Implemented portable component layer | Platform focus, keyboard, metrics and services remain host-specific |
| URL/Mux media components/controllers | Implemented composition | Native playback, curved/360 output and lifecycle depend on actual renderer/media path |
| Fishjam/WebRTC video adapter | Implemented adapter requiring fork API/native build | Requires external-video exports; release native builds/live-track device run not established by this handbook |
| Viro scene-panel web drag/pinch/scroll | Requires companion bridge/WASM | UI docs describe the dependency path; combined browser/device evidence not attached here |
| WebSpatial/web layout | Separate adapter path | Not synonymous with Viro Web rendering or arbitrary native window support |
| Specs, Meta wearables, OpenXR, VITURE packages | Platform-specific readiness | Inspect each adapter/transport; no uniform feature parity claim |

## Renderer and mode boundaries

A Viro panel in a projection swapchain, an independent OpenXR composition layer and an OS window are three different presentations. The compositor inventory scopes its proposed v1 to Android GLES and explicitly leaves Metal/Vulkan outside that v1. Do not extrapolate it into current visionOS or desktop simulator compositor support.

System-window availability must be checked in the intended shared/non-immersive mode. Coexistence with an active immersive OpenXR session is not assumed. Capability reports must follow real runtime probes, not device-name guesses.

## What “verified” must include

For every promotion to device-verified, record: repository and dependency SHAs; device and OS/runtime; renderer backend; debug/release and autolinking/build status; the tested feature; video/screenshots from the actual build; input/focus/cancellation results; reload/teardown behavior; performance measurements and limitations. Never use a generated concept image as test evidence.

CI's portable tests, a full TypeScript check, a native release build and a headset run are separate evidence levels. Preserve skipped/blocked results explicitly. [PR #60](https://github.com/mikevocalz/viro-external/pull/60) makes that CI separation explicit; this documentation change does not configure its protected environment.
