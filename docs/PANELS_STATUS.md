# Compositor Panels — verified branch inventory

Companion: [ViroCore #111](https://github.com/mikevocalz/virocore/pull/111).

## Present in #58 (verified against GitHub branch)

- `packages/ui/src/SpatialPanel.tsx`: curved scene mesh, world-locked `snapTo`, on-release slot snapping and Viro geometry. It is **not** an OpenXR compositor surface.
- `packages/ui/src/SpatialWorkspace.tsx`, `world-slot.ts`: captured origin, placement and nearest-slot math.
- `packages/viro-external-core/src/MovableNode.tsx`: controller release behavior needing device tests.
- `packages/ui/src/MetaWorkspaceHost.tsx`: optional Meta OS window facade integration; native promotion unverified.
- `packages/pico-layout/src/windowContainerHost.ts`: activity-backed PICO bridge; Subwindow/Augment not implemented.
- `packages/ui/src/SpatialPanels.types.ts`, `docs/SPATIAL_PANELS_API.md`: **type-only** next-stage design, not a runtime Expo Modules host.
- CI files and world-slot/PICO host contract test files exist on the branch; whether newest commits pass CI must be checked.

## Implementation stages, not success claims

- [x] Existing scene panel world slots, curved appearance, release and host adapter code exists in the draft.
- [x] Native compositor API designed as a TypeScript sketch without a fake implementation.
- [ ] SDK 58 / RN compatibility and Modules 2.0 Android autolinking + *release device* probe.
- [ ] Android Surface swapchain bridge and Expo 2.0 SharedObject native host.
- [ ] React Native root in a VirtualDisplay/Presentation, real pixels and reload-safe lifetime.
- [ ] Controller/hand pointer map, capture/cancel, and chrome drag snapping.
- [ ] Native runtime capability resolution and scene fallback under budget eviction.
- [ ] Native Meta/PICO OS system windows verified in non-immersive/shared-space mode.
- [ ] Quest 3 + PICO 4 Ultra screen recordings and performance/correctness matrix.
- [ ] Native C++ call-order tests, Kotlin↔TS API parity and release builds.

## v1 boundaries

Android GLES first. Metal and Vulkan are outside v1. `system-window` is only offered outside immersion until coexistence with active OpenXR is proven. Keep the Viro fork until an upstream Expo 58-compatible release passes device testing. Device availability is unconfirmed.
