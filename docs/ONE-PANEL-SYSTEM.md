# One premium panel system

**Production-facing owner:** `@viro-external/ui/SpatialPanel` (also re-exported through `@viro-external/premium`). A single `SpatialPanel` instance owns its Viro scene mesh, drag carrier, snapped world pose, pin/close state, header chrome, material, and content slot.

## No duplicate panels

- Use **one** `SpatialPanel` for each logical surface. Never stack a new `SpatialPanel` around a legacy panel or around `SpatialWorkspaceSlotNode`; both create an extra carrier and may double-apply placement.
- For a three-pane workspace, use `SpatialWorkspaceFrame` once and `SpatialPanel snapTo="left" | "center" | "right"`; on release the panel finds the nearest real slot. Set `shape="curved"` and `curvature` as needed.
- `@viro-external/gui/HolographicSlate` and `CylinderPanel` are **deprecated compatibility adapters** to the same `SpatialPanel` renderer. They no longer render an independent legacy title bar, border plate, close/pin state, or `MovableNode`. Only `CylinderPanel` retains its distinct arc **child layout**. Migrate imports to `@viro-external/ui`; do not ship both generations on the same screen.
- `@viro-external/core/ViroSlate` is a low-level external-texture primitive, **not** the premium production panel. `@viro-external/gui/DecaSlate` is a specialized animated pill-to-wide widget; do not use it as a general workspace panel. `PlanePanel`, `SpherePanel`, `StackPanel3D`, and `ScatterPanel` remain legacy **content-arrangement helpers**, not new panel shell choices.
- The Rive `@viro-external/spatial-panels` OpenXR compositor panel is a **different presentation backend**, not a second chrome design. Its native layer and `CompositorPanelFallback` must never be visible simultaneously: keep existing compositor/eviction single-presentation contract.

## Curvature and content

The unified background and header are real Viro geometry. Its `curved` flag bends the backing, not arbitrary embedded JSX or a live video texture. `CylinderPanel` places individual child controls on the same curvature with tangent rotations, retaining one panel owner. Its unified arc is at most 120°, and the adapter rejects wider grids instead of clipping or putting controls outside the surface. For genuinely curved video, use `SpatialMediaSurface` with the proper native renderer; for text-heavy curved content, compose actual Viro scene children in curved local poses.

## Material and interaction ownership

- `surfaceMaterial` accepts a pre-registered Viro material so existing external textures can bind without duplicating a panel shell; default surfaces use the unified premium material tokens.
- `opacity` applies to the panel and its chrome together.
- Pin/close, snap, drag and resize are exclusively controlled by the canonical panel's per-instance Zustand store; no legacy parallel `useState` store.
- Kinetrell remains the cross-platform motion owner when integrated by a consumer. Native compositor spring/swapchain behavior needs its separate device validation; do not claim the scene component is a native OS window.

## Examples

```tsx
import { SpatialWorkspaceFrame, SpatialPanel, PanelText } from "@viro-external/ui";

<SpatialWorkspaceFrame headPosition={[0, 1.6, 0]} headYawDeg={0}>
  <SpatialPanel title="Discover" shape="curved" curvature={0.28}
    snapTo="left" showCloseAction={false}>
    <PanelText text="Choose a scene" width={1.2} height={0.4} />
  </SpatialPanel>
  <SpatialPanel title="Canvas" shape="curved" curvature={0.28}
    snapTo="center" showCloseAction={false}>
    <PanelText text="Workspace" width={1.2} height={0.4} />
  </SpatialPanel>
  <SpatialPanel title="Inspector" shape="curved" curvature={0.28}
    snapTo="right" onClose={closeInspector}>
    <PanelText text="Properties" width={1.2} height={0.4} />
  </SpatialPanel>
</SpatialWorkspaceFrame>
```

This is a source/contract migration, not proof of Quest/PICO/visionOS production frame timing. The release gate remains: source checks and TypeScript, native package autolinking, clean native builds, controller/hand drag and snap on device, recenter/resume, actual visual inspection, memory/frame budget, and package install from a clean npm consumer.
