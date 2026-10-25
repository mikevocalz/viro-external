# Mobbin: stroke style sheet (colour, width, opacity, pressure)

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "color picker" | `search_screens` | iOS | 5 screens; 3 relevant |
| "brush settings" | `search_screens` | iOS | 5 screens; **none relevant** (general settings lists) |

Two web screens from the "drawing toolbar" and "drawing app canvas" runs also cover brush settings and are included below.

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | Polarsteps | https://mobbin.com/screens/1d64df0e-b4a8-410d-9fad-d2587befcf7f | Colour list where each swatch has a name ("Forest Green", "Ocean Blue") and a check on the selected one |
| 2 | Insight Timer | https://mobbin.com/screens/5e3b85ca-c087-42ac-9d34-be0c4c0a462e | Large rounded swatch grid with a custom-colour field |
| 3 | Structured | https://mobbin.com/screens/b230c60f-b162-4564-8e73-1113eb09638d | Swatch row with a hue slider and a lightness slider in a sheet |
| 4 | Shopify | https://mobbin.com/screens/784fb86c-ad78-403e-846a-d52ff8f4e672 | Draw panel: monochrome, standard and custom swatch groups, brush-size slider |
| 5 | Telegram | https://mobbin.com/screens/be19b256-c0df-4eec-b932-10b9755a1668 | Colour row, size slider with numeric value, tool list |

## Adopted

- Named swatches with a selected check (Polarsteps). The seven inks already have names (`'Black'` … `'Purple'`); show them as the accessible name and as a tooltip, and add a check so selection is not colour-only.
- Large, evenly spaced swatches (Insight Timer). The ink row's swatches are 104 artboard units with a 124 pitch; scale them with the key size fix in the a11y doc.

## Rejected

- Free hue and lightness sliders (Structured, Shopify custom). A free picker lets a learner pick yellow-on-white again; the fixed seven are a deliberate choice in `tokens.ts`.
- Opacity control: QuickDraw sets highlighter alpha at 0.55 and nothing else uses opacity.
- Pressure settings: pressure comes from the pen stream or is absent; never a user slider (master prompt §11).

## 2D to spatial

| 2D pattern | Spatial translation |
| --- | --- |
| Bottom sheet with swatches | Ink row replaces the tool row in place (`paletteOpen`); closing is a key in the same row |
| Size slider | Four discrete size keys (s, m, l, xl) if size is exposed at all |
| Check mark on the selected swatch | Same, plus inverted ring; visible at 2.6 m only if drawn at least 0.5° thick |
