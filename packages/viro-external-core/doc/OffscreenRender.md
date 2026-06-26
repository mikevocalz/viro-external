# OffscreenRender — 2D → texture pipeline

`ViroSlate` is a **container**, not a renderer. The 2D content → GPU texture handoff is the caller's job:

1. Caller renders content offscreen using a framework of choice (Skia Graphite, WebGPU canvas, native FBO).
2. Caller registers the resulting GPU surface with the Viro renderer via `react-native-viro-mux`'s `registerExternalTexture` → `ExternalTextureHandle`.
3. Caller passes the handle into `<ViroSlate externalTexture={handle} ... />`.

This separation exists because:

- The slate's geometry concerns (flat vs curved, corner radius, scale, movability) are orthogonal to texture production.
- Each producer (Skia/WebGPU/Native) has its own lifecycle, threading model, and color-space rules. Baking one in here would force everyone onto it.
- It keeps `@viro-external/core` JS-only — texture production lives in the producer's package or directly in app code.

## Reference producers (not shipped here)

| Producer                        | Output                              | Notes |
| ------------------------------- | ----------------------------------- | ----- |
| `@shopify/react-native-skia` (Graphite, when stable) | GPU `SkSurface` → `MTLTexture`/GL texture | Verify Graphite GPU-handoff API at integration time. |
| WebGPU (e.g. `react-native-wgpu`)| `GPUTexture` → IOSurface (iOS) / EGLImage (Android) | The slate doesn't care which API produced the texture; only the `ExternalTextureHandle` shape matters. |
| Native FBO                       | Renderer-native `glTexture` / `MTLTexture` | Wrap as `ExternalTextureSource` with `kind: 'gl-2d' \| 'iosurface'`. |

## Why not bake Skia in here?

Skia Graphite's GPU-surface-handoff API is **not yet shipping in `@shopify/react-native-skia`** as a verified public API (as of the version stream that pins to RN 0.86). Building against an unreleased symbol would violate the "no invented APIs" rule. When it lands, a thin adapter package (`@viro-external/skia-slate`) can produce the handle and pass it in. Until then, callers wire it themselves and `ViroSlate` stays unchanged.
