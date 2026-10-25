# Panel tokens

Skill applied: `design-system` (design plugin). Owner: L6. Workstream C (L4) reads corner radii from this file and nowhere else (master prompt §9).

Sources are cited per table. "Code" means a value read from a file on 2026-10-24. "Guidance" means a platform page that was opened and read for this file:

- Meta, Inputs and hit targets: https://latest.developers.meta.com/horizon/design/styles_inputs_hit_targets/ (last updated 2026-04-19)
- Meta, Hands UI best practices: https://developers.meta.com/horizon/design/hands-ui-best-practices/ (last updated 2026-08-17)
- Meta, Accessibility: https://developers.meta.com/horizon/design/accessibility/
- Meta, Panels: https://developers.meta.com/horizon/design/panels/ (last updated 2026-03-02)
- Apple HIG, Eyes: https://developer.apple.com/design/human-interface-guidelines/eyes (read from the page's JSON source)
- Apple HIG, Spatial layout: https://developer.apple.com/design/human-interface-guidelines/spatial-layout (read from the page's JSON source)

## 1. Corner radius

> **Approved 2026-10-24 (gate 3): angle-locked radii.** Radii hold their angle (0.840° board, 0.458° chrome) and convert to meters at each panel's distance. L4 reads these values.

### What exists today

| Where | Value | Source |
| --- | --- | --- |
| MoyoLearn panels (`XrPlate`, `XrRoundedQuad`) | 0.022 m | `packages/ui/xr/spatial-tokens.ts` `spatialCorners.panel` |
| MoyoLearn keys | 0.012 m | `spatialCorners.key` |
| MoyoLearn Rive board face | 0 (square `xrBoardBacking` quad) | `rive-board-panel.tsx` |
| viro-external `SpatialPanel` | 0.06 m default | `packages/ui/src/SpatialPanel.tsx` |
| viro-external curved panel | none (curved geometry has no radius) | `geometry.ts` `buildCurvedPanelGeometry` |

Neither Meta page nor either Apple page gives a corner radius in metres or degrees. Apple's Eyes page says: "In general, give an interactive item a rounded shape. The more rounded an item's shape, the easier it is for people to use their eyes to target it." That supports rounding keys; it gives no number.

### Problem

A radius in metres is right at one distance. MoyoLearn's 0.022 m was set against the 1.5 m design distance (`spatialDistance.board`), but the board now hangs at 2.6 m (`ARC_RADIUS`). At 2.6 m, 0.022 m subtends 29 arcmin and reads as nearly square. viro-external's 0.06 m subtends 79 arcmin at the same distance. The two codebases draw visibly different corners on panels that sit side by side.

### Proposal: angle-locked radius

Keep MoyoLearn's shipped look at its design distance and hold that angle at every distance. Radius in metres is computed per panel from its real distance `d`:

`radiusM = 2 · d · tan(angle / 2)`

| Token | Angle | At 1.0 m | At 1.5 m | At 2.0 m | At 2.6 m | Applies to |
| --- | --- | --- | --- | --- | --- | --- |
| `radius.board` | 0.840° | 0.0147 m | 0.0220 m | 0.0293 m | 0.0381 m | Whiteboard face, question panel |
| `radius.toolStrip` | 0.840° | same as board | | | | Rive tool strip when it is its own panel (gate 2) |
| `radius.toolKey` | 0.458° | 0.0080 m | 0.0120 m | 0.0160 m | 0.0208 m | Keys drawn in the `.riv`; authored in artboard units as `radiusM / CHROME_SCALE` |
| `radius.grip` | 0.458° | as key | | | | Grip bar |
| `radius.compositorQuad` | same as the panel it carries | | | | | B2 Rive quad layers; must equal the scene-panel value so an evicted layer that falls back to a mesh looks the same (§9) |
| `radius.cylinder` | same angle as the panel kind | | | | | Cylinder layers; applied in texture space and measured along the arc, so corners follow the curve |
| `radius.surfacePanel` | 0.840° | | | | 0.0381 m | RN-hosted Android Surface panels: the RN root draws `borderRadius` on a transparent background; Surface must carry alpha |

The angles are MoyoLearn's 0.022 m and 0.012 m at 1.5 m, converted. Nothing here is new styling; the change is that the value scales with distance.

Rules for every panel kind:

1. Clamp: `radiusM ≤ min(widthM, heightM) / 2`.
2. Pixel radius: `radiusPx = radiusM × widthPx / widthM`, per axis when the pixel aspect differs from the panel aspect (§9).
3. Rounding is alpha coverage from the shared L0 coverage function with a 1 px anti-aliased feather. No backend draws rounded geometry of its own.
4. Hit testing follows the coverage: a ray inside a transparent corner misses.
5. A panel that the user moves keeps the radius computed at placement until release, then recomputes. No per-frame radius change during a drag.

Alternatives considered:

| Option | Why not chosen |
| --- | --- |
| Fixed 0.022 m everywhere (MoyoLearn) | Near-square at 2.6 m (29 arcmin) |
| Fixed 0.06 m everywhere (viro-external) | Fine at 2.6 m, heavy on a 0.45 m near panel (7.6° at 0.45 m) |
| Two fixed values by kind | Still wrong whenever a panel moves along Z, which Meta's hands guidance warns about: "maintain its angular size rather than its physical size" |

## 2. Chrome and hit zones (angular)

| Token | Value | Basis |
| --- | --- | --- |
| `target.minAngle` | 4.0° | Code: MoyoLearn `spatialTarget.minAngleDeg`. Stricter than Meta. |
| `target.handMultiplier` | 1.25 | Code: `spatialTarget.handMultiplier` |
| `target.bandMultiplier` | young 1.636, child 1.273, teen 1.091, adult 1 | Code: ratios of `targets` 72/56/48/44 px in `packages/theme/tokens.ts` |
| Meta collider floor | ~2.5° to 3° | Guidance, Hands UI: "Minimum angular collider size: ~2.5° to 3° for both direct touch and ray casting." |
| Meta hit target | 48dp; 60x60 dp for primary controls with hands | Guidance, Inputs and hit targets |
| Meta size at touch distance | 22mm x 22mm / 48dp / 3° FOV at 0.42 m | Guidance, Accessibility |
| Meta spacing | 12 mm between interactables | Guidance, Hands UI |
| Apple spacing | centres at least 60 pt apart, or 16 pt margin around each item | Guidance, Eyes and Spatial layout. Apple gives no degree conversion, so none is made here. |
| Meta ray range | 0.46 m to 3 m | Guidance, Hands UI |
| Meta head tilt | avoid more than ±15° down for long periods | Guidance, Hands UI |

Derived from Meta's own numbers (48dp = 3°), 60dp is about 3.75°. That derivation is ours; Meta does not state it.

What these floors mean in metres:

| Angle | At 1.5 m | At 2.6 m |
| --- | --- | --- |
| 2.5° | 0.066 m | 0.114 m |
| 3.0° | 0.079 m | 0.136 m |
| 4.0° | 0.105 m | 0.182 m |
| 4.0° x young (1.636) | 0.171 m | 0.297 m |

The current Rive tool keys are 0.100 x 0.085 m (2.2° x 1.9° at 2.6 m). They miss every row of this table. See the a11y doc for the fix options.

## 3. Colour

All hex values are sRGB-encoded, as authored. Values come from MoyoLearn `packages/theme/tokens.ts` through `packages/ui/xr/xr-colors.ts` unless marked.

### Paper and ink

| Token | Hex | Source |
| --- | --- | --- |
| `color.paper` | #FFFFFF | `XR_SURFACE.paper` = `surface-raised.light` |
| `color.ink.black` | #1d1d1d | `board-black` (QuickDraw light-theme stroke) |
| `color.ink.blue` | #4263eb | `board-blue` |
| `color.ink.red` | #e03131 | `board-red` |
| `color.ink.green` | #099268 | `board-green` |
| `color.ink.yellow` | #f1ac4b | `board-yellow` |
| `color.ink.orange` | #e16919 | `board-orange` |
| `color.ink.violet` | #ae3ec9 | `board-violet`, labelled "Purple" |
| `color.highlight.alpha` | 0.55, `multiply` on light paper | QuickDraw `HIGHLIGHT_ALPHA`, `shapes.js` |

### Chrome

| Token | Hex | Source |
| --- | --- | --- |
| `color.chrome.rail` | #262420 | `XR_SURFACE.rail` (ink 800) |
| `color.chrome.key` | #F6F3E8 | `XR_SURFACE.key` (ink 100) |
| `color.chrome.keySelected` | #0D0C0B | `XR_SURFACE.keySelected` (ink 950) |
| `color.chrome.onKey` | #171614 | `XR_COLOR.onKey` (ink 900) |
| `color.chrome.onKeySelected` | #FFFDF7 | `XR_COLOR.onKeySelected` (ink 50) |
| `color.chrome.onPanel` | #FFFDF7 | `XR_COLOR.onPanel` |
| `color.chrome.onPanelMuted` | #C4C0B0 | `XR_COLOR.onPanelMuted` (ink 300) |
| `color.focus` | #3B6DF6 | `XR_SURFACE.focus` (`gold[500]`, which is a blue in this palette) |
| `color.void` | #171614 | `XR_COLOR.void` |
| `color.grip` | #ffc168 | Raw literal `xrBoardGrip` in `rive-board-panel.tsx`; **not tokenised**, move into the theme |
| `color.boardEmpty` | #112d44 | Raw literal `xrBoardEmpty`; **not tokenised** |
| `color.boardBacking` | #0a1524 | Raw literal `xrBoardBacking`; **not tokenised** |

viro-external `packages/ui/src/materials.ts` carries its own generic panel palette and no ink palette. **Open:** decide whether `@viro-external/ui` takes these tokens or stays brand-neutral with an injected theme.

### Alpha and transfer handling

| Route | Rule | Source |
| --- | --- | --- |
| Scene panels (board, Rive B1) | Producer writes **premultiplied** alpha in sRGB-encoded bytes. `useCanvasPanel` gains `blendMode: "PremultiplyAlpha"`; the resolve copy keeps premultiplied values and builds mips from them. | ADR D6 |
| Compositor panels (Rive B2) | Finish pass converts to **linear premultiplied** for `GL_SRGB8_ALPHA8` swapchains. | ADR D6, prompt fact 18 |
| Today's scene path | Alpha copied straight; material `Alpha` blend expects straight alpha. Changing to premultiplied without changing the blend gives dark halos on corners. | ADR "Sampling (fact 16, changed)" |
| Highlighter | Composited by the board renderer (`multiply`, 0.55) in sRGB-encoded canvas space, matching QuickDraw on the web. It is not a layer-level alpha. | QuickDraw `shapes.js` |
| Colour gate | Mid-grey swatch and a 50%-alpha swatch over passthrough must match the token with no halo on the corner edge. | Master prompt §9 |

## 4. Type scale

The roster names Inter (Rasmus Andersson's seat). **Inter is not bundled in either repo today.** MoyoLearn ships Space Grotesk, Archivo Black and Chivo Mono (`packages/assets/fonts`, `fontFamilies` in `tokens.ts`); viro-external `ViroText` uses the system face. **Open:** adopt Inter for spatial chrome, or apply this scale to Space Grotesk.

Glyph heights below are MoyoLearn's `spatialType` ranges, which were measured on a Quest 3S at 1.5 m ("0.05 m body text was legible at 1.5 m only with effort; 0.07 m is read at a glance", `spatial-tokens.ts`). Held as angles so they survive the move to 2.6 m:

| Step | Glyph height at 1.5 m (code) | Angle | At 2.6 m | Weight (proposed, Inter) |
| --- | --- | --- | --- | --- |
| `type.caption` | 0.035-0.049 m | 1.34°-1.87° | 0.061-0.085 m | 500 |
| `type.body` | 0.055-0.075 m | 2.10°-2.86° | 0.095-0.130 m | 400 |
| `type.title` | 0.10-0.15 m | 3.82°-5.72° | 0.173-0.260 m | 600 |

`ViroText` maps 1 pt to 0.01 m (`kTextPointToWorldScale`), and labels render at 4x point size with the node scaled by 0.25 (`spatialLabelScale`) so glyphs keep enough texels.

Board text (QuickDraw `FONT_SIZES`, page px) at today's mapping of 1 page px = 0.977 mm, seen from 2.6 m:

| Size | Page px | Height | Angle |
| --- | --- | --- | --- |
| s | 20 | 19.5 mm | 0.43° |
| m | 26 | 25.4 mm | 0.56° |
| l | 36 | 35.2 mm | 0.77° |
| xl | 48 | 46.9 mm | 1.03° |

Only `xl` reaches the 1.0° minimum text size in Meta's `hz-immersive-designer` skill checklist. **Open:** raise the board's default text size, or scale the page so text reaches 1° at the board's distance.

## 5. Stroke widths

QuickDraw sizes (`palette.js`, 0.2.0) at 1 page px = 0.977 mm, seen from 2.6 m:

| Size | Freehand ink (`INK_SIZES`) | Geometry (`SIZES`) | Highlighter band (`SIZES` x 4.5) |
| --- | --- | --- | --- |
| s | 3.4 px, 3.3 mm, 4.4 arcmin | 2.5 px, 2.4 mm | 11.0 mm |
| m | 5.2 px, 5.1 mm, 6.7 arcmin | 4.0 px, 3.9 mm | 17.6 mm |
| l | 6.5 px, 6.4 mm, 8.4 arcmin | 6.5 px, 6.4 mm | 28.6 mm |
| xl | 10 px, 9.8 mm, 12.9 arcmin | 10 px, 9.8 mm | 44.0 mm |

Stroke tokens stay in page px so the native board matches the web board exactly (ADR D2: outlines come from QuickDraw's `strokeOutline`). The metre and arcmin columns change if the paper's pixel size or distance changes, so the renderer must derive them, not hard-code them.

## 6. Spacing and depth

| Token | Value | Source |
| --- | --- | --- |
| `space.xs / sm / md / lg / xl` | 0.025 / 0.05 / 0.1 / 0.2 / 0.35 m | `spatialSpacing` |
| `layer.surface / content` | 0.004 / 0.012 m | `spatialLayer` |
| `layer.raster / ink` | 0.0005 / 0.001 m | `boardLayer` |
| `layer.pointer` | 0.002 m | `POINTER_STANDOFF` |
| `depth.subtle / standard / strong / hero` edge | scale 1.012-1.05, offset -0.006 to -0.016 m | viro-external `visual-depth.ts` |
