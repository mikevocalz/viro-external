# @viro-external/webspatial

WebSpatial 2.x adapter for the shared `@viro-external/xr-contract` layout intent.

Use this for **spatial web presentation**. It does not replace Viro's WebXR/WebGL renderer.

## Install

```bash
pnpm add @viro-external/webspatial @webspatial/react-sdk@^2 @webspatial/core-sdk@^2
```

Configure the WebSpatial JSX runtime in the consuming web app:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@webspatial/react-sdk"
  }
}
```

Wrap once at the client-rendered root:

```tsx
import { SpatialBoot } from "@viro-external/webspatial";

export function Root() {
  return (
    <SpatialBoot>
      <App />
    </SpatialBoot>
  );
}
```

## Spatialize a shared surface

```tsx
import { createWebSpatialElementProps } from "@viro-external/webspatial";

const intent = {
  id: "reference",
  preferredPresentation: "spatial-web-element",
  fallback: "inline",
  preferredSize: { width: 420, height: 620 },
  resizable: true,
} as const;

const xr = createWebSpatialElementProps(intent, {
  back: 80,
  backgroundMaterial: "translucent",
});

export function ReferencePanel() {
  return (
    <section
      className={xr.className}
      style={xr.style}
      data-viro-spatial-surface={xr["data-viro-spatial-surface"]}
    >
      <ReferenceContent />
    </section>
  );
}
```

The helper uses WebSpatial's `__enableXr__` marker so the same DOM remains normal HTML in ordinary browsers.

## Manifest scene

```ts
import { createWebSpatialMainScene } from "@viro-external/webspatial";

const manifest = {
  name: "Moyo Spatial",
  start_url: "/",
  xr_main_scene: createWebSpatialMainScene(intent),
};
```

## PICO OS 6

PICO OS 6's standalone Web App Runtime includes WebSpatial Runtime. A WebSpatial-enabled website can therefore run spatially by URL without WebSpatial Builder packaging. The normal PICO browser remains a normal browser; launch it as a standalone Web App to get the runtime.

## Meta Horizon

Do not use this package as Meta's native panel implementation today. WebSpatial currently lists Meta Horizon OS as planned support. Viro's native Meta path uses Standard Android / Meta Layout for system windows and ViroCore/OpenXR for immersive rendering.

## WebXR

WebSpatial and WebXR are composable but separate. Starting a WebXR session takes over the space; the WebSpatial page UI is hidden while the WebXR renderer owns the immersive session. Do not promise simultaneous unified rendering.
