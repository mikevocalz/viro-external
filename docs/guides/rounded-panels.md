# Rounded panels

[Handbook](../README.md) · [Panel tokens](../design/system/panel-tokens.md) · [API](../API_WHITEBOARD_RIVE_PANELS.md) · [Device validation](../DEVICE_VALIDATION.md)

Canvas panels, Rive panels and the native whiteboard get rounded corners from one shared function in ViroCore (`ViroRenderer/VROPanelCoverage.h`). Producers keep drawing square content. Viro multiplies each pixel by the coverage of a rounded rectangle when it copies the frame for the scene, or in the compositor's finish pass, with a one-pixel anti-aliased edge. Every route that uses this function draws the same corner for the same radius, and a panel that moves from a compositor layer to the scene fallback keeps its corners.

Hit testing uses the same function. A ray or pen inside a transparent corner misses.

## Where it runs

| Route | Status |
| --- | --- |
| Android scene panels: `useCanvasPanel`, `ViroRivePanel`, `ViroNativeRivePanel`, the native whiteboard's material | Rounded by Viro's resolve copy, with a renderer AAR from viro commit `e41d43b8` or later (virocore `d5e219c1`) |
| Android compositor layers (Rive route B2, quad and cylinder) | Rounded by the finish pass in the same renderer; needs a B2 host, none is merged yet |
| iOS | `useCanvasPanel` and `ViroRivePanel` accept `cornerRadius` and do not apply it; panels render square |
| visionOS | Not implemented |
| `SpatialPanel` | Rounds with its own mesh geometry (`buildRoundedPanelGeometry`), not the shared function; default radius 0.06 m |

Pixel rounding on Android is not yet confirmed on a headset; see [device validation](../DEVICE_VALIDATION.md) R2 and C1.

## Choose a radius

Radii are angle-locked (gate 3, [panel tokens](../design/system/panel-tokens.md) §1). The token is an angle; convert it to meters at the panel's distance `d` when you place the panel:

```ts
const radiusM = (angleDeg: number, distanceM: number) =>
  2 * distanceM * Math.tan((angleDeg * Math.PI) / 180 / 2);

radiusM(0.84, 2.6);  // board at 2.6 m: about 0.0381
radiusM(0.84, 1.4);  // tool strip at 1.4 m: about 0.0205
```

| Token | Angle | Use |
| --- | --- | --- |
| `radius.board`, `radius.toolStrip`, `radius.surfacePanel` | 0.840° | Whiteboard paper, question panel, Rive tool strip as its own panel |
| `radius.toolKey`, `radius.grip` | 0.458° | Keys inside the `.riv`, the grip bar |
| `radius.compositorQuad`, `radius.cylinder` | same as the panel kind | B2 layers; must equal the scene-panel value |

Rules from the token file: clamp to half the shorter side; keep the radius computed at placement for the whole of a drag and recompute on release. No package exports this conversion; it is the formula above.

## Adopt

### Canvas panel (`useCanvasPanel`)

```ts
const panel = useCanvasPanel({
  producerFactory,
  resolution: { width: 2048, height: 1280 },
  blendMode: "PremultiplyAlpha",          // if the producer writes premultiplied alpha
  cornerRadius: radiusM(0.84, 2.0),       // meters
  panelSize: { width: 1.0, height: 0.625 }, // required when cornerRadius > 0
});
```

`cornerRadius` without `panelSize` throws before any native resource is created: "cornerRadius needs panelSize with a positive width and height in meters".

### Rive panels

`ViroRivePanel` and `ViroNativeRivePanel` take `cornerRadius` in meters and use `width` and `height` as the panel size:

```tsx
<ViroNativeRivePanel nativeRive={flags.nativeRive} source={source}
  width={0.6} height={0.375} cornerRadius={radiusM(0.84, 1.4)} />
```

The native route also hands the radius to `RivePanel` so presses in a transparent corner never reach Rive.

### Native whiteboard

The board has two radius inputs, and both must carry the same value:

1. The `canvasSource` material you allocate: `cornerRadius`, `panelWidth` and `panelHeight` on the `diffuseTexture`. This rounds the pixels.
2. `QuickDrawNativeBoard`'s `cornerRadiusM`. This is used only for hit testing.

```tsx
const BOARD_RADIUS_M = radiusM(0.84, 2.6);

ViroMaterials.createMaterials({
  boardPaper: {
    diffuseTexture: { canvasSource: BOARD_SURFACE_ID, width: 2016, height: 1260,
      cornerRadius: BOARD_RADIUS_M, panelWidth: 1.2, panelHeight: 0.75 },
    lightingModel: "Constant",
    blendMode: "PremultiplyAlpha",
  },
});

<QuickDrawNativeBoard /* ... */ widthM={1.2} heightM={0.75} cornerRadiusM={BOARD_RADIUS_M} />
```

`QuickDrawNativeBoard` gives the renderer `cornerRadiusPx: 0` on purpose. A non-zero producer radius would round the corners a second time.

### Hit testing in your own code

`@viro-external/ui` exports a binary32 port of the coverage function, so a hit test agrees with the drawn pixels:

```ts
import { isInsideRoundedPanel, panelCornerRadiiPx } from "@viro-external/ui";

const radii = panelCornerRadiiPx(radiusM, widthM, heightM, widthPx, heightPx);
const hit = isInsideRoundedPanel(xPx, yPx, widthPx, heightPx, radii); // coverage >= 0.5
```

## Rollback

Set the radius to 0. `useCanvasPanel` then adds no corner keys to the material, and hit tests accept the whole rectangle. On iOS, where the pixels stay square, pass 0 to hit-test helpers as well, so a ray in a square-drawn corner is not dropped.

## Colour and alpha

Rounded corners are partially transparent pixels, so they show alpha mistakes first:

- Scene panels: the producer writes premultiplied alpha in sRGB-encoded bytes, and the material uses `blendMode: "PremultiplyAlpha"`. Premultiplied content under the default `Alpha` blend gives dark halos at the corner edge (panel tokens, "Alpha and transfer handling").
- Compositor layers: the finish pass converts to linear premultiplied for `GL_SRGB8_ALPHA8` swapchains and passes premultiplied encoded bytes through for `GL_RGBA8` (virocore `docs/OPENXR_PANEL_COMPOSITOR.md`).

The acceptance check is a mid-grey swatch and a 50 % alpha swatch over passthrough, with no halo on the rounded edge, on Quest 3 and PICO 4 Ultra ([device validation](../DEVICE_VALIDATION.md) R2, X2).
