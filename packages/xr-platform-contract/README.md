# @viro-external/xr-contract

Small, vendor-neutral contracts shared by Viro's platform adapters.

This package deliberately contains **no renderer and no vendor SDK**. It describes the overlap between platforms so Meta Horizon/OpenXR, PICO/WebSpatial, Meta AI glasses, and Snap Specs can share application intent without pretending they run the same engine.

```ts
import type {
  SpatialSurfaceIntent,
  PortableXRNode,
  PortableXRInteraction,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

const referencePanel: SpatialSurfaceIntent = {
  id: "reference",
  preferredPresentation: "system-window",
  fallback: "inline",
  preferredSize: { width: 420, height: 620 },
  placement: "end",
  movable: true,
  resizable: true,
};
```

## Rules

- Capabilities describe runtime evidence, not product-name guesses.
- `supported` means the adapter has a real underlying path, not merely a TypeScript type.
- Renderers remain native to their platform.
- Unsupported features must stay explicit; adapters do not silently turn an immersive scene into a screenshot.
- Input source and semantic phase are separated so gaze can target while pinch commits.

See `doc/Architecture.md` for the platform mapping.
