# @viro-external/xr-contract

Small, vendor-neutral contracts shared by Viro's platform adapters.

This package deliberately contains **no renderer and no vendor SDK**. It describes the overlap between Viro/OpenXR, Meta Horizon Layout, PICO Spatial, WebSpatial, Meta AI glasses, and Snap Specs without pretending they run the same engine.

```ts
import type {
  SpatialSurfaceIntent,
  SpatialWorkspaceIntent,
  PortableXRNode,
  PortableXRInteraction,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

const workspace: SpatialWorkspaceIntent = {
  id: "tutor-room",
  maxPromotedSurfaces: 2,
  surfaces: [
    {
      id: "navigation",
      role: "master",
      preferredPresentation: "system-window",
      fallback: "inline",
      placement: "start",
      priority: "permanent",
      preferredSize: { width: 320, height: 560 },
      resizable: true,
      opaqueRoot: true,
    },
    {
      id: "reference",
      role: "inspector",
      preferredPresentation: "system-window",
      fallback: "inline",
      placement: "end",
      priority: "secondary",
      preferredSize: { width: 420, height: 620 },
      resizable: true,
      opaqueRoot: true,
    },
  ],
};
```

## Semantic layout roles

- **master** — navigation, list, rail, or source selection;
- **content** — the main task surface;
- **inspector** — contextual detail/reference/tools;
- **accessory** — toolbar, controls, transport, or compact utility surface;
- **popup** — short-lived modal or contextual surface;
- **volume** — true volumetric container;
- **immersive** — full XR scene/stage.

The role describes *meaning*. A platform adapter decides the concrete presentation.

## Rules

- Capabilities describe runtime evidence, not product-name guesses.
- `supported` means the adapter has a real underlying path, not merely a TypeScript type.
- Renderers remain native to their platform.
- Keep engine `SpatialPanel` and OS `SpatialWindow` concepts separate.
- Unsupported features must stay explicit; adapters do not silently turn an immersive scene into a screenshot.
- Input source and semantic phase are separated so gaze can target while pinch commits.
- `gaze-targeting` describes object targeting/hover; `eye-gaze` is reserved for raw gaze data when available.
- World-query and surface-placement capabilities describe real runtime paths, not device-name assumptions.
- Spatial geometry should be stable; animate content inside a promoted surface rather than resizing/re-anchoring it every frame.
- The main app surface remains authoritative. Extra spatial surfaces are progressive enhancement and must define inline/drop fallback.

See `doc/Architecture.md` and `doc/SpatialWorkspace.md` for the platform mapping.
