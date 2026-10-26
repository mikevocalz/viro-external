# Mobbin: pages / board navigator and export

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "page thumbnails" | `search_screens` | iOS | 5 screens; 1 relevant |
| "export share sheet" | `search_screens` | iOS | 5 screens; 3 relevant |

Four references in total; the thumbnails query returned mostly photo grids and cover pickers.

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | Pool | https://mobbin.com/screens/a8faad5a-a4cb-42ab-815d-dfb9ca1ad863 | A sheet holding a grid of page thumbnails above the current collection |
| 2 | WHOOP | https://mobbin.com/screens/72245e7f-faee-4efb-b078-315632e093d4 | Share sheet: large preview card, then Copy, Download, Message, More, with a "Copied" toast |
| 3 | Bevel | https://mobbin.com/screens/b45b3515-f24a-45c6-873b-cdfdd20cd46c | Swipeable preview carousel with Save image, Copy image, Share |
| 4 | Perplexity | https://mobbin.com/screens/bf6f870b-1e78-404c-944b-0769c8ee0606 | Preview of the exported image with Copy Image and Download Image, and a "Copied to clipboard" confirmation |

## Adopted

- Preview before export (WHOOP, Bevel, Perplexity). The board already exports a PNG for Ask (`engine.exportPng()`); show that PNG before it leaves the headset.
- One confirmation after the action ("Copied", "Copied to clipboard"). Short and specific.

## Rejected

- Swipeable carousels (Bevel): a horizontal swipe on a ray is imprecise; use previous / next keys if multiple pages exist.
- More / system share targets: the product sends the board to Natalie only. The camera primer copy promises that "The only thing that leaves is a board you press Ask on" (`tutor-xr-screen.native.tsx`). A general share target would break that promise.

## 2D to spatial

| 2D pattern | Spatial translation |
| --- | --- |
| Thumbnail grid in a sheet | Thumbnail panel in a side slot, each thumbnail sized to the target floor |
| Share sheet with preview | Preview on the board itself, with Send and Cancel on the strip |
| Toast | Status line in the chrome (`status`), not a floating toast |

Note: the board has one page today. A navigator only matters once multi-page boards exist.
