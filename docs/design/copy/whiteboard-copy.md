# Whiteboard copy

Skill applied: `ux-copy` (design plugin). Every string marked **existing** was found in code and is quoted exactly, with its file. Strings marked **new** do not exist anywhere in MoyoLearn or viro-external today. Paths are MoyoLearn unless they start with `viro-external/`.

Search notes: there are no locale or i18n files in either repo; all copy is inline. There is no user-facing copy for a stylus, pen pairing or handedness. The board ships three tools today (`'draw' | 'highlight' | 'eraser'`, `packages/ui/whiteboard.types.ts`).

## Voice

The existing XR copy talks to a child doing homework: plain words, the learner's work is "your board" and "your working", and failures say that nothing is lost. Keep that. Lead with what happened, then what to do. No exclamation marks, no blame.

## 1. Tool names

The same tool has three names today. One name per tool, used for the key label, the accessible name and the tooltip title.

| Tool | Recommended | Existing variants | Status |
| --- | --- | --- | --- |
| draw | **Pen** | `'Pen'` (`Whiteboard.tsx:230`, `board-controls.ts:18`, `tutor-xr-screen.native.tsx:901`) | existing |
| highlight | **Highlighter** | `'Highlighter'` (`Whiteboard.tsx:231`, `tutor-xr-screen.native.tsx:902`), `'Mark'` (`board-controls.ts:19`) | existing; drop `'Mark'` |
| eraser | **Eraser** | `'Eraser'` (`Whiteboard.tsx:232`, `tutor-xr-screen.native.tsx:903`), `'Erase'` (`board-controls.ts:20`) | existing; drop `'Erase'` |
| ink well | **Pen colour: {colour}** as the accessible name; the key shows the swatch | `` `Pen color: ${currentInk.label}` `` (`Whiteboard.tsx:641`), `` `Ink: ${ink}` `` (`tutor-xr-screen.native.tsx:904`, shows the raw id) | existing; drop the raw-id form. Spelling: the code uses US "color"; keep whichever the product locale uses, consistently |
| undo | **Undo** | `'Undo'` | existing |
| redo | **Redo** | `'Redo'` | existing |
| clear | **Clear board** | `'Clear'` (tray, rail), `'Clear board'` (fallback), aria `"Clear the board"` | existing |
| clear, armed | **Confirm clear** | `'Confirm clear'` (`tutor-xr-screen.native.tsx:910`) | existing |
| clear, cancel | **Keep my work** | `'Keep my work'` (`:913`) | existing |
| ask | **Ask Natalie** | `'Ask Natalie'` (`Whiteboard.tsx:408`), `` `Ask ${TUTOR_NAME}` `` (`tutor-xr-screen.native.tsx:596`), `'Ask'` (tray, rail) | existing |
| ask, sending | **Sending** | `'Sending'` (`XrBoardTray.native.tsx:144`) | existing |
| grip | **Hold to move** / **Moving board** | `rive-board-panel.tsx:326` | existing |

Ink names (existing, `board-controls.ts:36-42`): `'Black'`, `'Blue'`, `'Red'`, `'Green'`, `'Yellow'`, `'Orange'`, `'Purple'`.

Tools the ADR ports into the headless editor (D1) that have no copy yet. All **new**:

| Tool id | Label | Tooltip |
| --- | --- | --- |
| `geo` | Shapes | Draw a box, circle or triangle |
| `arrow` | Arrow | Draw an arrow |
| `line` | Line | Draw a straight line |
| `text` | Text | Type on the board |
| `note` | Note | Add a sticky note |
| `select` | Select | Pick marks to move or resize |
| `hand` | Move paper | Slide the paper around |
| `laser` | Pointer | Point at something without drawing |

"Move paper" for `hand` keeps it apart from the grip's "Hold to move", which moves the whole board.

## 2. Tooltips

All **new**. Shown on hover after a delay (Apple's Eyes page recommends a slightly longer delay for hover effects that show extra information). One line, no trailing full stop.

| Key | Tooltip |
| --- | --- |
| Pen | Write and draw |
| Highlighter | Colour over your work |
| Eraser | Remove a whole mark |
| Pen colour | Change the colour |
| Undo | Undo the last change |
| Redo | Bring it back |
| Clear board | Remove everything on the board |
| Ask Natalie | Send your board to Natalie |
| Hold to move | Hold and drag to move the board |

The eraser tooltip says "whole mark" because the QuickDraw 0.2.0 eraser deletes every shape it touches (`editor.js:715-723`, ADR D1). It never erases part of a stroke.

## 3. Status line (`status` on the Rive view model)

Existing values, set in `tutor-xr-screen.native.tsx`. Empty string means healthy.

| Situation | String | Status |
| --- | --- | --- |
| Idle | `'Ask Natalie'` (via `askLabel`) | existing |
| Board not ready | `'Waiting for your board…'` | existing |
| Ask failed | `'Could not send — try again'` | existing |
| Mic listening | `'Listening — press to send'` | existing |
| Mic opening | `'Opening microphone…'` | existing |
| Processing | `'One moment…'` | existing |
| Mic denied | `'Microphone is off'` | existing |
| Not heard | `"Didn't catch that — try again"` | existing |
| No mic | `'Microphone unavailable'` | existing |

## 4. Empty, loading and error states

| State | Copy | Status |
| --- | --- | --- |
| Board loading | `'Getting your board ready'` | existing (`XrPanel.native.tsx:359`) |
| Restoring work | `'Bringing your working over'` | existing (`XrPanel.native.tsx:359`) |
| Connecting | `'Connecting your board…'` | existing (`tutor-xr-screen.native.tsx:874`) |
| Empty board, ask pressed | `Write your work on the board, then ask again.` | existing (`Whiteboard.tsx:767`) |
| Board timed out | `'Board unavailable — return to lesson'` | existing (`:874`) |
| Headset unsupported | `"This headset can't open the spatial whiteboard yet. Your board is waiting on the normal screen — nothing is lost."` | existing (`XrPanel.native.tsx:388`) |
| Marks the headset cannot draw | `"1 thing you added on the computer isn't shown here. It's still on your board."` and the plural form | existing (`XrChatPanel.native.tsx:173-174`) |
| Chrome failed (log only) | `` `Board controls unavailable: ${error.message}` `` | existing; developer-facing, never shown to the learner |
| Empty board, first open | **Write anywhere on the paper.** | new |
| Board error, generic | **Your board stopped drawing. Your work is saved.** Button: **Try again** | new; "Try again" reuses `retry: 'Try again'` (`tutor-opening.tsx`) |

## 5. Surface lost and layer evicted

All **new**. The rebuild is automatic (handoff doc), so the copy reports, it does not ask.

| State | Copy | Notes |
| --- | --- | --- |
| Surface lost, rebuilding | **Redrawing your board…** | Shown on the paper until the first frame lands |
| Rebuild failed | **Your board stopped drawing. Your work is saved.** Button: **Try again** | Same as the generic error |
| Layer evicted (B2 fallback) | none | The fallback looks identical; a message would only alarm |
| A stroke was cut off by the loss | **Your last line didn't finish. Draw it again.** | Only when a stroke was cancelled mid-draw |

## 6. Pen pairing and input settings

All **new**. No product names: the code path is `MusePenInput`, but the learner sees "pen". Do not claim a pen is connected unless the native stream says so (master prompt §11).

| Moment | Copy |
| --- | --- |
| Settings row | **Pen** |
| No pen paired | **No pen connected. You can draw with your controller or your hand.** |
| Pairing, instruction | **Turn your pen on and hold it near the headset.** |
| Pairing, waiting | **Looking for your pen…** |
| Paired | **Pen connected** |
| Pairing failed | **Couldn't find your pen. Check it's turned on, then try again.** Button: **Try again** |
| Disconnected mid-session | **Pen disconnected. Keep drawing with your controller or hand.** |
| Pressure not available | **This pen doesn't send pressure, so lines stay one width.** |
| Handedness row | **I write with my** — options **Left hand** / **Right hand** |
| Handedness helper | **We'll put the tools on the other side so your arm doesn't cover them.** |

The handedness helper describes a behaviour that does not exist yet. Ship the copy only with the mirrored strip (see `../research/whiteboard-xr-research.md`, question 3).

## 7. Accessible names

The XR scene exposes no `accessibilityLabel` today; a key's visible word is its only name (`board-controls.ts:30-33`). Rive keys have no name at all. Each key below needs its name exposed by the native Rive surface.

| Element | Accessible name | Role / state | Status |
| --- | --- | --- | --- |
| Tool group | `"Drawing tool"` | radio group | existing (`Whiteboard.tsx:578`) |
| Pen / Highlighter / Eraser | `'Pen'` / `'Highlighter'` / `'Eraser'` | radio; selected | existing |
| Colour group | `"Pen color"` | radio group | existing (`Whiteboard.tsx:459`) |
| Each swatch | ink name (`'Black'` …) | radio; selected | existing |
| Colour well | `` `Pen color: ${currentInk.label}` `` | button; expanded | existing |
| Undo | `"Undo"` | button; disabled when `!canUndo` | existing |
| Redo | **Redo** | button; disabled when `!canRedo` | new (2D board has no redo key) |
| Clear | `"Clear the board"` | button; disabled when `!hasMarks` | existing |
| Clear, armed | **Confirm clearing the board** | button | new |
| Ask | `'Ask Natalie'` | button; busy when `asking` | existing |
| Grip | **Move the board** | button; pressed while held | new |
| Paper | **Your board** | drawing canvas | existing title (`'Your board'`, `WhiteboardSheet.tsx:67`) |
| Close | `"Close the board"` | button | existing (`WhiteboardSheet.tsx:61`) |
| Recenter | `'Recenter workspace'` | button | existing (`tutor-xr-screen.native.tsx:884`) |

## Localization notes

- Expect up to 40% expansion. The tool strip keys are 104 artboard units wide; "Highlighter" already needs a smaller weight or a second line in some languages. Test the longest locale before locking key widths.
- "Hold to move" is an instruction about a physical action; translate the action, not the words.
- Keep "Natalie" untranslated.
