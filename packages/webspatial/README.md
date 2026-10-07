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

Do not use this package as Meta's spatial-DOM implementation today. WebSpatial 2.x currently lists Meta Horizon OS as **planned** support rather than a supported runtime.

For Meta web today:

- normal React/HTML -> Quest Browser or PWA;
- browser 3D -> Viro Web or Meta IWSDK;
- immersive -> WebXR / IWSDK;
- native React Native app -> Meta Layout SDK for OS spatial windows.

That keeps native Meta `SpatialWindow` APIs out of the web bundle.

## Viro Web + WebXR

WebSpatial, Viro Web and WebXR solve different layers:

- WebSpatial spatializes DOM/layout;
- Viro Web renders 3D/AR into a WebGL2/WASM canvas;
- WebXR owns immersive browser sessions.

A Viro Web canvas can live inside the normal/web-spatialized React layout, but the current Viro fork does not implement `ViroVRSceneNavigator.web` as a WebXR session. Route immersive web to WebXR/IWSDK until that renderer path exists.

WebSpatial and WebXR are composable but separate. Starting an immersive WebXR session takes over the XR presentation; do not promise that ordinary spatialized page UI remains simultaneously visible.

## Scene options

`createWebSpatialMainScene()` also writes the WebSpatial 2.0 manifest options `world_scaling`, `world_alignment`, and `baseplate_visibility`. `@webspatial/core-sdk` 2.0.0 reads the snake_case keys; the manifest output has not been loaded on a PICO or visionOS runtime.

PICO OS 6 includes the WebSpatial Runtime in its standalone Web App Runtime. WebSpatial 2.x also supports visionOS packaging; Meta Horizon support is currently planned.
