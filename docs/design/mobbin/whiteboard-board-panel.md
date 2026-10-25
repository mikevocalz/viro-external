# Mobbin: whiteboard board panel (canvas + drag chrome)

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "whiteboard canvas" | `search_screens` | iOS | 5 screens; 2 relevant |
| "drawing app canvas" | `search_screens` | web | 5 screens; 1 relevant |
| "draw and erase" | `search_flows` | iOS | 3 flows; all relevant |

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | Freeform | https://mobbin.com/flows/5fcdf616-f213-405f-90dc-7ae2f9aeb0ed | Selecting an object eraser: dotted canvas, floating pen tray at the bottom, an eraser sheet with a Pixel / Object toggle |
| 2 | Brave Browser | https://mobbin.com/flows/b59705df-6351-42f2-94e7-6a7a183c29f4 | Editing whiteboard: blank white canvas, one tool row along the top, undo / redo / eraser in a separate bar at the bottom |
| 3 | Freeform | https://mobbin.com/flows/9f0aa9df-5b56-44b1-a75c-3ae13ff9fbb7 | Deleting a drawing: context menu over a selected drawing, Delete in red at the end |
| 4 | Givingli | https://mobbin.com/screens/dbd7bb1a-d7a3-44c6-8fa4-5ad61d9c0d85 | A rounded white card as the writing surface on a dark, textured ground, tools in a strip below |
| 5 | Replit | https://mobbin.com/screens/27a48223-d90d-4dca-aa67-532fc19d4f48 | Hand-drawn sketch on a plain canvas, floating tool dock and colour row docked at the bottom centre |

## Adopted

- The paper fills its window edge to edge with no grid by default (Brave, Replit). The QuickDraw board already draws plain light paper.
- Light paper on a dark surround (Givingli). The board's backing slab is dark navy and the paper is white; keep that separation.
- Object eraser semantics (Freeform's "Object Eraser" option). QuickDraw 0.2.0 only has whole-mark erase, which matches this option. The copy says "Remove a whole mark".

## Rejected

- Freeform's Pixel / Object eraser toggle: there is no partial erase in QuickDraw 0.2.0 (ADR D1), so offering the choice would be a lie.
- Freeform's long-press context menu for delete: long-press on a ray is slow and easy to trigger by accident in a headset; Undo and Select + delete cover it.
- Dotted grid canvas (Freeform): adds noise at 2.6 m and competes with the learner's handwriting.

## 2D to spatial

| 2D pattern | Spatial translation |
| --- | --- |
| Canvas fills the screen | Paper fills the board window, 0.985 x 0.615 m at 2.6 m (21.4° wide), inside the ±30° comfort cone |
| Bottom toolbar near the thumb | Tool strip above the paper today; the research plan tests above vs side vs mirrored |
| Drag a canvas by scrolling | Separate grip bar under the panel; drawing and moving never share an input |
| Rounded card corners | `radius.board` on the face, applied by the shared coverage function |

## Pass 2 (2026-10-25)

Re-run of the same queries through the Mobbin MCP for the device-validation lane. The five references above still apply; the new results below were added only where they show something the first pass did not.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "whiteboard canvas" | `search_screens` | iOS | 8 screens; 2 new and relevant (Yubo, Ahead); Givingli and Cash App repeat |
| "draw and erase" | `search_flows` | iOS | 5 flows; 1 new and relevant (Freeform "Drawing on a board"); the other 3 Freeform/Brave flows repeat or cover eraser size |

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 6 | Freeform | https://mobbin.com/flows/043dd666-daee-4571-b1c2-68b2f758f60e | Drawing on a board: Undo is greyed on the empty board and lights after the first mark; the pen tray replaces the insert bar while drawing |
| 7 | Yubo | https://mobbin.com/screens/35bf2986-80e0-45e6-8e2e-25e453a5231c | A white rounded card on a coloured ground with one centred placeholder, "Draw here" |
| 8 | Ahead | https://mobbin.com/screens/b366fcb1-b0c8-44bf-b51b-9c387c35d97f | A small drawing card with one clear (X) control beside the mark and the main action below |

Adopted: Undo disabled until the first mark (Freeform) matches the handoff's empty state, where Undo, Redo and Clear start disabled. A single centred line on empty paper (Yubo) matches the empty-board copy.

Rejected: Ahead's clear control beside the drawing. On the board, Clear stays in the strip with its two-step confirm; a lone X next to the paper is a small target at 2.6 m and easy to hit by accident.

## Held up on device?

**Not yet run.** For each adopted pattern, the session in `../../validation/session-plan.md` checks whether it still works at 2.6 m on Quest 3S and PICO 4 Ultra.

| Pattern | Device check | Quest 3S | PICO 4 Ultra |
| --- | --- | --- | --- |
| Plain paper edge to edge, no grid | Paper reads as one surface; no moiré or shimmer at 2.6 m | not yet run | not yet run |
| Light paper on dark surround | Paper edge visible over bright and dim passthrough | not yet run | not yet run |
| Whole-mark erase | Eraser removes the mark aimed at, not a neighbour | not yet run | not yet run |
| Undo disabled until first mark | Disabled state is visible on the strip and does not rely on colour alone | not yet run | not yet run |
| One line of copy on empty paper | Line readable at 2.6 m and gone after the first mark | not yet run | not yet run |
