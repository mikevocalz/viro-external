# Mobbin: text and image insert

Status: **run** 2026-10-24 through the Mobbin MCP.

| Query | Tool | Platform | Result |
| --- | --- | --- | --- |
| "text formatting toolbar" | `search_screens` | iOS | 5 screens; 3 relevant |
| "insert image" | `search_screens` | iOS | 5 screens; 2 relevant |

## References

| # | App | Link | What it shows |
| --- | --- | --- | --- |
| 1 | Givingli | https://mobbin.com/screens/3d327cc2-6b47-43af-aefb-f7c1789b8f41 | Selected text on a card with a floating action pill (lock, layers, duplicate) and a bottom row: Edit, Font, Color, Size |
| 2 | Luma | https://mobbin.com/screens/3caaa6a0-e03a-4341-b7d4-a8448cda1c8a | Formatting row (H1, H2, B, I, link, lists, quote) docked above the keyboard |
| 3 | Shopify | https://mobbin.com/screens/dd4173ab-1ad5-4bb2-a010-cfce1ba0830c | B / I / U, alignment and list controls above the keyboard |
| 4 | Notion | https://mobbin.com/screens/cf573f99-fcd7-4e70-886b-8f13dd56f660 | "Insert Media" sheet: Photo library, Take photo or video, Scan Document, Choose Files |
| 5 | ElevenLabs | https://mobbin.com/screens/bccb1a46-56ff-4321-9e2e-6fc116f3510c | Image placeholder in place with upload progress ("46%") |

## Adopted

- Text editing controls dock to the keyboard (Luma, Shopify). In the headset, the formatting row attaches to the system keyboard panel, not to the board, so it never covers the paper.
- A short, labelled insert sheet (Notion). For the board: "Photo" and "Take photo" only, if image insert ships.
- In-place placeholder with progress (ElevenLabs). The board shows the image's frame immediately and fills it when the upload finishes, so the learner sees where it will land.

## Rejected

- Rich formatting (headings, lists, links, quotes). QuickDraw text has size and font only (`FONT_SIZES`, `FONTS`).
- A floating action pill over the selection (Givingli). Same hover-shift problem as contextual chips; selection actions go on the strip.
- Scan Document: no document flow exists on the board.

## 2D to spatial

| 2D pattern | Spatial translation |
| --- | --- |
| Keyboard slides up from the bottom | System keyboard panel appears below the board; focus rules in the a11y doc |
| Formatting row above keyboard | Size keys (s, m, l, xl) on the keyboard panel |
| Insert sheet | Short list on a panel to the side of the board, not over the paper |
| Upload placeholder | Frame drawn on the paper at the target position with a progress caption |

Note: text and image insert are not in the board's current tool set (`'draw' | 'highlight' | 'eraser'`). This file prepares for the tools ADR D1 ports.
