# Spatial workspace contract

The workspace contract keeps application layout semantic while allowing each runtime to choose its native presentation.

## Canonical roles

| Role | Flat / compact | Expanded / tablet | Meta Horizon Layout | PICO Spatial | Viro immersive |
| --- | --- | --- | --- | --- | --- |
| master | stack/drawer | navigation rail / leading pane | start SpatialWindow | left Subwindow / Augment | left engine panel |
| content | full screen | detail pane | main Android/RN window | DefaultWindowContainer | center scene/panel |
| inspector | sheet | trailing inspector | end SpatialWindow | right Subwindow / Augment | right engine panel |
| accessory | bottom sheet | toolbar | bottom/anchored SpatialWindow when capacity allows | Toolbar / Augment | floating controls |
| popup | modal | popover | priority SpatialWindow | SpatialPopup | floating modal panel |
| volume | inline preview | inline preview | adapter-specific / Viro | volumetric WindowContainer | 3D node/volume |
| immersive | unavailable | optional | Viro/OpenXR | Stage / Viro/OpenXR | Viro scene |

## Three-slot continuity

The existing Viro LEFT / CENTER / RIGHT composition maps directly:

- LEFT -> master/start
- CENTER -> content/main
- RIGHT -> inspector/end

Do not duplicate the authored layout for Meta, PICO, or web. Adapters resolve the same surface intents into native primitives.

## Capacity and priority

Spatial capacity is platform-owned. The application should declare priority instead of assuming every requested window can be promoted.

Default semantic ordering:

1. permanent (4)
2. primary (3)
3. popup (2)
4. secondary (1)
5. ephemeral (0)

The numeric form remains available for platform-specific tuning.

## Fallback

Every surface declares either:

- inline — render at the declaration site when spatial promotion is unavailable;
- drop — omit the secondary surface when it cannot be promoted.

The main/content surface must never depend on promotion.

## Geometry stability

Window size, anchor, offset, and other OS-level geometry should be treated as layout configuration, not animation state. Per-frame animation belongs inside the surface in Viro/Reanimated/Worklets/WebGPU.

This avoids expensive relayout/process-boundary churn and keeps the same rule valid across Meta and PICO.

## Ownership boundary

- `@viro-external/xr-contract`: semantic intent and capabilities.
- Meta/PICO adapters: OS window/container creation and placement.
- `@viro-external/ui`: Viro engine panels and interaction chrome.
- Viro renderer: immersive scene composition and 3D.
- Runtime/compute layer: worklets, GPU compute, native memory ownership.

A platform adapter may expose native extensions, but applications should stay on the shared contract whenever the feature is portable.
