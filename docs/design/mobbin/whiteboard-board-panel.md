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
