# Web platform matrix

Status verified 2026-10-03.

## PICO OS 6

PICO documents WebSpatial as a first-class web development path. Its OS-level standalone Web App Runtime includes the WebSpatial Runtime, so a WebSpatial-enabled React site can spatialize without a native Builder package on PICO OS 6.

WebSpatial 2.x currently supports PICO OS 6 and visionOS. Its documentation lists Meta Horizon OS as planned, not supported.

## Meta Horizon OS

Meta officially supports:

- ordinary hosted 2D websites in Quest Browser;
- PWAs distributed through the Horizon Store;
- screen-based 3D browser apps;
- immersive WebXR;
- IWSDK for browser-first 3D and XR systems.

The Meta native React Native Layout SDK is a separate Android path and should not be imported into a web bundle.

## Viro Web

Viro 3.x now has a WebGL2/WASM renderer through `@reactvision/viro-web-renderer` and React Native Web.

The current fork supports:

- Viro3DSceneNavigator.web -> browser canvas / WASM renderer;
- ViroARSceneNavigator.web -> browser camera + visual-inertial tracking;
- many Viro nodes through .web implementations.

Current boundary:

- ViroVRSceneNavigator.web explicitly does not provide a VR/WebXR headset session.

Therefore the recommended composition is:

```text
responsive DOM / PWA
  |
  +-- WebSpatial surfaces (PICO OS 6 / visionOS runtime)
  |
  +-- Viro Web canvas for embedded 3D / AR
  |
  +-- WebXR / IWSDK for immersive headset mode
```

## Feature detection

Do not infer capability from user-agent strings. Resolve at runtime:

- WebSpatial runtime support through the WebSpatial SDK;
- WebXR through `navigator.xr` / session support checks;
- Viro Web through renderer initialization / WebGL2 capability;
- responsive layout from actual viewport/container dimensions.
