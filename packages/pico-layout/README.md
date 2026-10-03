# @viro-external/pico-layout

PICO Spatial SDK adapter for the shared `@viro-external/xr-contract` workspace intent.

The package intentionally does not link PICO native artifacts itself. Native SDK ownership remains in `expo-pico`; this package turns product-level roles into PICO presentation intent.

## Current PICO mapping

Verified against PICO Spatial SDK 6.1.9 documentation on 2026-10-03:

| Shared role | PICO primitive |
| --- | --- |
| content | planar `WindowContainer` |
| master | left/right `Subwindow`, otherwise `Augment` |
| inspector | left/right `Subwindow`, otherwise `Augment` |
| accessory | `Toolbar` or `Augment` |
| popup | `SpatialPopup` |
| volume | volumetric `WindowContainer` |
| immersive | `Stage` |
| attached RN/Viro utility surface | `AttachmentPanelComponent` |

A PICO `WindowContainer` is currently associated with an Android `Activity`, so separate top-level containers should be treated as real native windows/surfaces, not fake React children.

## React Native surface hosting

PICO's `AttachmentPanelComponent` can host an Android `View` in spatial space. That is the bridge point for React Native/Fabric surfaces without rewriting application UI in Compose.

```text
React component
  -> React Native Fabric surface
  -> Android View
  -> PICO AttachmentPanelComponent
  -> spatial entity
```

## Usage

```ts
import { resolvePicoSurface } from "@viro-external/pico-layout";

const surface = resolvePicoSurface(
  {
    id: "reference",
    role: "inspector",
    placement: "end",
    preferredPresentation: "system-subwindow",
    fallback: "inline",
    preferredSize: { width: 420, height: 620 },
  },
  {
    isSpatialAvailable: true,
    supportsWindowContainer: true,
    supportsSubwindow: true,
    supportsAugment: true,
    supportsToolbar: true,
    supportsSpatialPopup: true,
    supportsVolume: true,
    supportsStage: true,
    supportsAttachmentPanel: true,
  }
);
```

The result is consumed by the PICO native bridge in `expo-pico`.

## Viro ownership

Viro remains the immersive renderer. PICO `Stage` is a platform container/lifecycle primitive; the actual 3D scene can still be Viro/OpenXR when that is the selected renderer.
