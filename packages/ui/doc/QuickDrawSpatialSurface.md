# QuickDrawSpatialSurface

`QuickDrawSpatialSurface` is the native spatial presentation boundary for the QuickDraw editor.

The component does not implement a second drawing engine. QuickDraw remains the document/editor authority. The adapter owns the native renderer and must expose an **ESIKU-backed external render target** as a Viro material.

Architecture:

    QuickDraw core/editor
        -> NativeQuickDrawSpatialAdapter
        -> ESIKU external render target
        -> Viro material
        -> QuickDrawSpatialSurface
        -> Viro scene

Spatial input is normalized to 0..1 UVs and dispatched through the adapter. Panel movement is independent of board editing and uses the existing `MovableNode` contract.

The component deliberately contains no WebView, screenshot, raster replay loop, bitmap frame stepping, or JS per-frame canvas renderer.

## Adapter contract

`NativeQuickDrawSpatialAdapter` is branded with `renderer: "esiku"` so another renderer cannot accidentally be substituted while preserving the same API.

The current repository does not ship the concrete ESIKU QuickDraw adapter implementation yet; this PR establishes the reusable component and the exact renderer seam for it.
