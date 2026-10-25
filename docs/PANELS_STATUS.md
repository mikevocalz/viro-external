# Compositor Panels — verified branch inventory

Companion: [ViroCore #111](https://github.com/mikevocalz/virocore/pull/111).

## Present in #58 (verified against GitHub branch)

- `packages/ui/src/SpatialPanel.tsx`: curved scene mesh, world-locked `snapTo`, on-release slot snapping and Viro geometry. It is **not** an OpenXR compositor surface.
- `packages/ui/src/SpatialWorkspace.tsx`, `world-slot.ts`: captured origin, placement and nearest-slot math.
- `packages/viro-external-core/src/MovableNode.tsx`: controller release behavior needing device tests.
- `packages/ui/src/MetaWorkspaceHost.tsx`: optional Meta OS window facade integration; native promotion unverified.
- `packages/pico-layout/src/windowContainerHost.ts`: activity-backed PICO bridge; Subwindow/Augment not implemented.
- `packages/ui/src/SpatialPanels.types.ts`: the PR #58 **type-only** sketch, kept as is.
- `packages/spatial-panels` (`@viro-external/spatial-panels`): Expo Modules API 2.0 host for **Rive** compositor panels, with the scene fallback toggle. See `docs/SPATIAL_PANELS_API.md`.
- Local validation: UI/core TypeScript checks, five world-slot/panel-state tests, two PICO host tests, and 37 workspace-surface tests pass. CI validates the pushed commit separately.
- Panel placement, pin/close state, workspace origin and movable-node scale use per-instance Zustand stores; imperative gesture handles remain in refs.

## Implementation stages, not success claims

- [x] Scene-panel world slots, curved panels, drag release, and the Meta and PICO host adapters. Typecheck and unit tests pass; not run on a headset.
- [x] Native compositor API designed as a TypeScript sketch without a fake implementation.
- [ ] SDK 58 / RN compatibility and Modules 2.0 Android autolinking + *release device* probe. The package follows `expo-crypto` 58's v2 layout; no app build has autolinked it yet.
- [x] Expo 2.0 SharedObject native host for Rive panels (`CompositorPanel` over virocore `com.viro.core.RiveCompositorPanel`). kotlinc 2.2.21 compile without the v2 compiler plugin; no Gradle build, no device run.
- [ ] Android Surface swapchain bridge (`XR_KHR_android_surface_swapchain`) for non-Rive content.
- [ ] React Native root in a VirtualDisplay/Presentation, real pixels and reload-safe lifetime.
- [ ] Controller/hand pointer map, capture/cancel, and chrome drag snapping.
- [x] Native runtime capability resolution (`getCapabilities()` from the session) and scene fallback under budget eviction for Rive panels: `CompositorPanelFallback` shows a `PremultiplyAlpha` quad or arc while evicted. 15 node tests with a fake native module; not run on a headset. Non-Rive producers have no fallback.
- [ ] Native Meta/PICO OS system windows verified in non-immersive/shared-space mode.
- [ ] Quest 3 + PICO 4 Ultra screen recordings and performance/correctness matrix.
- [ ] Native C++ call-order tests, Kotlin↔TS API parity and release builds.

## v1 boundaries

Android GLES first. Metal and Vulkan are outside v1. `system-window` is only offered outside immersion until coexistence with active OpenXR is proven. Keep the Viro fork until an upstream Expo 58-compatible release passes device testing. Device availability is unconfirmed.
