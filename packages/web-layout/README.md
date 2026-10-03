# @viro-external/web-layout

One web layout policy for ordinary browsers, PICO WebSpatial, Meta Horizon web/PWA/WebXR, and Viro's WebGL2/WASM renderer.

## The important split

Web layout and web 3D rendering are separate capabilities:

- **ordinary web / PWA** — DOM/CSS master-content-inspector layout;
- **WebSpatial** — promotes HTML/React surfaces into spatial elements/scenes where a WebSpatial Runtime exists;
- **Viro Web** — renders Viro 3D/AR scenes into a WebGL2/WASM canvas;
- **WebXR** — owns immersive headset sessions on the web.

Do not treat Viro Web as WebXR today. The current Viro fork's `ViroVRSceneNavigator.web` intentionally renders nothing; use WebXR/IWSDK for immersive browser sessions until that changes.

## Platform matrix

| Target | Flat / responsive | Spatial DOM | Browser 3D / AR | Immersive web |
| --- | --- | --- | --- | --- |
| Desktop/mobile browser | CSS | fallback only | Viro Web | WebXR when browser supports it |
| PICO OS 6 Web App Runtime | CSS | WebSpatial | Viro Web | WebXR |
| Meta Horizon Browser / PWA | CSS/PWA | WebSpatial not supported today | Viro Web or IWSDK | WebXR / IWSDK |
| visionOS WebSpatial shell | CSS | WebSpatial | Viro Web where browser support permits | platform-dependent |

## Same workspace

```ts
const environment = {
  width: window.innerWidth,
  webSpatial: "pico-os-6",
  viroWeb: true,
  webXR: "xr" in navigator,
} as const;

const reference = resolveWebSurface(
  {
    id: "reference",
    role: "inspector",
    preferredPresentation: "spatial-web-element",
    fallback: "inline",
  },
  environment
);
```

On PICO OS 6, that inspector can become a WebSpatial element. In a normal browser the same semantic surface falls back to the responsive inspector/sheet layout.

## Responsive roles

- compact: content = main, master = drawer, inspector = sheet, accessory = toolbar
- dual pane: master = rail, content = main, inspector = secondary inspector
- triple pane: master / content / inspector all visible

Use `createWebWorkspaceStyle()` for the expanded CSS grid and your app's normal drawer/sheet primitives in compact mode.
