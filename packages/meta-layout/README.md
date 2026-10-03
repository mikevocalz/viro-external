# @viro-external/meta-layout

Meta Horizon Layout SDK adapter for the shared `@viro-external/xr-contract` surface intent.

This package **does not replace Viro**. It handles OS-level spatial windows around the main React Native app while Viro continues to own immersive rendering and engine-level `SpatialPanel` UI.

## Current Meta model

Verified against Meta Horizon Layout documentation on 2026-10-03:

- React Native uses `@metavr/layout-compat` and `@metavr/layout-window-compat`.
- `SpatialSceneProvider` wraps the spatial subtree once.
- `SpatialWindow` takes a stable `label`, width/height, anchor, priority, promotable state, and inline/drop fallback.
- Horizon OS earlier than v207 falls back instead of promoting.
- The current React Native integration reserves two promoted spatial-window slots.
- OS-level geometry should remain stable; animate content inside a window instead.

## Intent mapping

```tsx
import { SpatialWindow } from "@metavr/layout-window-compat";
import { toMetaSpatialWindowProps } from "@viro-external/meta-layout";

const intent = {
  id: "reference",
  role: "inspector",
  preferredPresentation: "system-window",
  fallback: "inline",
  placement: "end",
  priority: "secondary",
  preferredSize: { width: 420, height: 620 },
} as const;

<SpatialWindow {...toMetaSpatialWindowProps(intent)}>
  <ReferencePanel />
</SpatialWindow>;
```

Wrap the app once with `SpatialSceneProvider` from `@metavr/layout-compat`.

## Expo CNG

Meta's native BOM and Layout artifacts belong in an Expo config plugin so `npx expo prebuild --clean` can regenerate Android safely. Do not hand-edit every consuming app's generated Gradle files.

## Layout rule

Use:

- master -> start window
- content -> main React Native window
- inspector -> end window
- accessory -> promoted only when capacity allows; otherwise inline
- popup -> higher-priority temporary window
- immersive -> Viro/OpenXR, not a Layout SDK window

Keep the main task usable when every extra spatial window falls back.
