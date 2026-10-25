/**
 * The fallback material. The native module sets its diffuse texture.
 * Premultiplied blending matches the texture; constant lighting shows the
 * pixels as the compositor would; no depth writes, so transparent corners do
 * not hide what is behind them; no culling, so winding cannot drop the arc.
 */
export const FALLBACK_MATERIAL = {
  lightingModel: "Constant",
  blendMode: "PremultiplyAlpha",
  diffuseColor: "#ffffff",
  writesToDepthBuffer: false,
  readsFromDepthBuffer: true,
  cullMode: "None",
} as const satisfies Record<string, unknown>;
