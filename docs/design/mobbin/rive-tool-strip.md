# Mobbin: Rive tool strip (pen, highlighter, eraser, shapes, text, select, undo/redo)

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "drawing toolbar" | `search_screens` | iOS | 5 screens; 1 relevant (Cash App) |
| "drawing toolbar" | `search_screens` | web | 5 screens; 4 relevant |
| "pen tool picker" | `search_screens` | iOS | 5 screens; **none relevant** (generic list pickers) |

The iOS run returned mostly photo-markup screens, so the same query was also run on web.

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | Base44 | https://mobbin.com/screens/d1428fe4-129d-4126-a5ca-b6d93973f867 | Vertical floating tool rail on the right edge: select, hand, pen, image |
| 2 | Recraft | https://mobbin.com/screens/e4b989f2-5749-4c8e-ba1c-ee9c37e3b6ea | Vertical tool rail on the left with undo and redo at the bottom of the same rail |
| 3 | Telegram | https://mobbin.com/screens/be19b256-c0df-4eec-b932-10b9755a1668 | Side panel: colour row, size slider with a number, tool list where each row previews its stroke (Pen, Arrow, Marker, Neon, Blur, Eraser) |
| 4 | Replit | https://mobbin.com/screens/c8816a79-99e0-4ac4-830e-6a39bc2a52e7 | Contextual colour chips beside a selected element, with a separate mode dock at the bottom |
| 5 | Cash App | https://mobbin.com/screens/609fe46a-41d3-4f0b-a4dc-b9fc86fe3d2f | Large round tool buttons above and below a drawing surface, selected tool inverted to black |

## Adopted

- Selected tool shown by inversion (Cash App). Matches MoyoLearn's `keySelected` rule (ink on light key, 17.59:1) and gives a cue that is not colour-only.
- Undo and redo on the same strip as the tools (Recraft). The Rive strip already does this; Clear sits after them.
- Each tool previews its stroke (Telegram). Useful for Pen vs Highlighter, which look alike as icons.

## Rejected

- Tiny icon-only rails (Base44, Recraft). Their keys are far under the 2.5°-4° floors once placed at 2.6 m.
- Contextual chips that appear beside the selection (Replit). In a headset they move under the ray as the selection moves, the hover-driven layout shift Meta's hands guidance warns against.
- A size slider (Telegram). A slider thumb is a small target; QuickDraw has four discrete sizes, so use four keys.

## 2D to spatial

| 2D pattern | Spatial translation |
| --- | --- |
| Icon toolbar at 24-44 px | Keys sized by angle: at least 3° collider with hit slop, 4° visual floor in MoyoLearn tokens |
| Undo/redo in the toolbar | Same band, after the tools, separated from Clear |
| Colour row expands in place | `paletteOpen` swaps the tool row for the ink row in the same band; nothing overlaps the paper |
| Vertical rail on one side | Candidate for left-handed mirroring (research question 3) |
