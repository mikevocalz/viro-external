# Accessibility review: whiteboard and Rive panels

Skill applied: `accessibility-review` (design plugin), with `hz-immersive-designer` for the spatial checks. Standard: WCAG 2.1 AA (https://www.w3.org/TR/WCAG21/). Date: 2026-10-24.

Scope: the token values in `../system/panel-tokens.md` and the geometry in `../handoff/whiteboard-rive-panels.md`. This is a review of values in code, not of a running build. Nothing here was tested with a person or a screen reader in a headset. Colours inside `moyo_board_chrome.riv` were not read, so the Rive key fills are not covered.

Contrast ratios were computed with the WCAG 2.1 relative-luminance formula from the hex values in the tokens file.

## Summary

| Severity | Count | Items |
| --- | --- | --- |
| Critical | 2 | Tool keys under every target floor (O1); Rive chrome has no accessible names (R1) |
| Major | 4 | Yellow ink fails non-text contrast (P1); `reducedMotion` hard-coded (O3); board text under 1° (P3); no non-pen path for text entry confirmed (O2) |
| Minor | 3 | Highlighter bands low against paper (P2); connecting tile indistinguishable from backing (P4); tool names inconsistent (U1) |

## Perceivable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| P1 | Yellow ink `#f1ac4b` on paper is 1.95:1. Strokes are graphics the learner must see, so 1.4.11 (3:1) applies. Orange (3.37) and green (3.95) pass 3:1 but fail 4.5:1 if read as text. | 1.4.11 | Major | Darken yellow to a value that reaches 3:1 on white, or drop it from the default seven. The value is copied from QuickDraw, so changing it diverges from the web board; record that in `tokens.ts`. |
| P2 | Highlighter bands (multiply at 0.55) range 1.44:1 (yellow) to 3.79:1 (black) against paper. Black ink on every band stays readable (4.45:1 to 11.68:1). | 1.4.11 | Minor | A highlight is emphasis, not information. Acceptable if the highlighted mark itself still reads. The black band (`#838383`) puts black ink at 4.45:1, just under 4.5:1. |
| P3 | Board text at QuickDraw's default `m` size subtends 0.56° at 2.6 m; only `xl` reaches 1.0°. | 1.4.4 (spirit), hz-immersive-designer text floor | Major | Scale the page so `m` reaches at least 1° at the board's distance, or move the board closer. Then confirm on device. |
| P4 | Connecting state: the empty tile `#112d44` on the backing `#0a1524` is 1.29:1, so the paper window has no visible edge while the board connects. | 1.4.11 | Minor | Show the paper colour with the connecting line on it, or outline the window. |
| P5 | No captions issue for the board itself; the status line is text. Tutor speech captions are out of scope here. | 1.2.x | n/a | |

### Contrast table

| Element | Foreground | Background | Ratio | Required | Pass |
| --- | --- | --- | --- | --- | --- |
| Black ink | #1d1d1d | #FFFFFF | 16.86 | 3:1 graphic / 4.5:1 text | Yes |
| Blue ink | #4263eb | #FFFFFF | 4.98 | 3:1 / 4.5:1 | Yes |
| Red ink | #e03131 | #FFFFFF | 4.51 | 3:1 / 4.5:1 | Yes |
| Violet ink | #ae3ec9 | #FFFFFF | 4.85 | 3:1 / 4.5:1 | Yes |
| Green ink | #099268 | #FFFFFF | 3.95 | 3:1 / 4.5:1 | Graphic yes, text no |
| Orange ink | #e16919 | #FFFFFF | 3.37 | 3:1 / 4.5:1 | Graphic yes, text no |
| Yellow ink | #f1ac4b | #FFFFFF | 1.95 | 3:1 | **No** |
| Black ink on black highlight band | #1d1d1d | #838383 | 4.45 | 4.5:1 | **No** (by 0.05) |
| Black ink on blue band | #1d1d1d | #97A9F4 | 7.46 | 4.5:1 | Yes |
| Label on rail | #FFFDF7 | #262420 | 15.23 | 4.5:1 | Yes |
| Muted label on rail | #C4C0B0 | #262420 | 8.49 | 4.5:1 | Yes |
| Label on resting key | #171614 | #F6F3E8 | 16.28 | 4.5:1 | Yes |
| Label on selected key | #FFFDF7 | #0D0C0B | 19.21 | 4.5:1 | Yes |
| Resting key vs rail | #F6F3E8 | #262420 | 13.94 | 3:1 | Yes |
| Selected key vs resting key | #0D0C0B | #F6F3E8 | 17.59 | 3:1 | Yes |
| Focus ring vs resting key | #3B6DF6 | #F6F3E8 | 4.02 | 3:1 | Yes |
| Focus ring vs selected key | #3B6DF6 | #0D0C0B | 4.38 | 3:1 | Yes |
| Focus ring vs rail | #3B6DF6 | #262420 | 3.47 | 3:1 | Yes |
| Focus ring vs paper | #3B6DF6 | #FFFFFF | 4.46 | 3:1 | Yes |
| Grip vs backing | #ffc168 | #0a1524 | 11.42 | 3:1 | Yes |
| Paper vs backing | #FFFFFF | #0a1524 | 18.33 | 3:1 | Yes |
| Connecting tile vs backing | #112d44 | #0a1524 | 1.29 | 3:1 | **No** |
| Rive key fills, labels, focus | in `.riv` | in `.riv` | not measured | | **Open** |

Passthrough is a background too. Over a bright room the backing slab keeps chrome contrast stable; any chrome drawn with `uiOpacity < 1` must be re-measured against passthrough.

## Operable

| # | Issue | WCAG / guidance | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| O1 | Rive tool keys are 0.100 x 0.085 m at 2.6 m: **2.2° x 1.9°**. Floors: MoyoLearn's own 4° (`spatialTarget.minAngleDeg`), Meta's ~2.5°-3° collider and 48dp / 60dp for hands. Key gaps are 11.5 mm against Meta's 12 mm. | 2.5.5 (spirit), Meta Hands UI, Meta Inputs and hit targets | Critical | Pick one, decided with the research plan: (a) move the board to 1.5 m, where the same keys are 3.8° x 3.2° (still under 4°, over Meta's 3°); (b) keep 2.6 m and grow keys to 0.182 m for 4° adult, which no longer fits eight keys in one 1.2 m row and needs two rows; (c) add invisible hit slop to reach 3° (0.136 m) with the visual key unchanged, as Meta recommends. The young band multiplier (1.636) applies on top of any of these. |
| O2 | Every tool needs a path that does not need a pen (table below). Text entry has no confirmed native path yet. | 2.1.1, 2.5.1 | Major | See "Non-pen alternatives". |
| O3 | `reducedMotion` is the constant `true` in `tutor-xr-screen.native.tsx:844` and `tutor-question-panel.tsx:64`, and `false` in `xr-layout-probe.tsx:307`. It never reflects a setting. | 2.3.3 (AAA), comfort | Major | Read React Native `AccessibilityInfo.isReduceMotionEnabled()` plus an in-app toggle and push the result. Whether Horizon OS and PICO OS report a system value through that API is **unverified**; test on device. |
| O4 | Two-step Clear exists (`clearArmed`, `'Keep my work'`) and Undo restores a clear. | 3.3.4 (spirit) | Pass | Keep. |
| O5 | Grip and pointer plane are separate; a held board takes no ink. | 2.5.2 | Pass | Keep. |
| O6 | Seated reach and head tilt are not measured. Meta Hands UI: avoid more than ±15° head-down for long periods. | Comfort | Open | Research plan question 4. |
| O7 | Focus order for controller navigation is undefined for the Rive strip. Meta Accessibility: "Make sure all UI elements are reachable through controller navigation." | 2.4.3, 2.4.7 | Open | Order: tool keys left to right, colour well, Undo, Redo, Clear, Ask, then the paper, then the grip. Focus ring uses `color.focus`. |

### Angular target sizes

| Target | Size (m) | At 1.5 m | At 2.0 m | At 2.6 m |
| --- | --- | --- | --- | --- |
| Tool key | 0.100 x 0.085 | 3.8° x 3.2° | 2.9° x 2.4° | 2.2° x 1.9° |
| Ask key | 0.158 x 0.085 | | | 3.5° x 1.9° |
| Grip | 0.650 x 0.090 | | | 14.3° x 2.0° |
| Floor, Meta collider | | 2.5°-3° | 2.5°-3° | 2.5°-3° |
| Floor, MoyoLearn adult | | 4° | 4° | 4° |
| Floor, MoyoLearn young | | 6.5° | 6.5° | 6.5° |

The grip's 2.0° height is also under every floor.

### Non-pen alternatives

| Tool | Pen | Controller ray | Hand | Other |
| --- | --- | --- | --- | --- |
| Pen (draw) | Yes | Trigger held | Pinch held | none; drawing needs some pointer |
| Highlighter | Yes | Yes | Yes | none |
| Eraser | Yes | Yes | Yes | Undo removes the last mark; Select + delete when `select` ships |
| Colour | Tap swatch | Yes | Yes | none |
| Undo / Redo | Tap | Yes | Yes | **Open:** controller button shortcut |
| Clear | Tap twice | Yes | Yes | none |
| Ask | Tap | Yes | Yes | Voice: the Ask flow already listens (`'Listening — press to send'`) |
| Text (when ported) | n/a | Opens keyboard | Opens keyboard | System keyboard or a paired physical keyboard; **open**, see IME below |
| Move board | Grip | Grip | Grip | `'Recenter'` brings it back without dragging |

Every drawing action already works with a controller or a hand, so the pen is never required. Answers that a learner cannot draw (motor impairment) need the text tool or voice; neither is confirmed on the native board yet.

## Understandable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| U1 | The same tool is called "Highlighter" and "Mark", "Eraser" and "Erase", depending on the surface. | 3.2.4 | Minor | Use the names in `../copy/whiteboard-copy.md` §1. |
| U2 | Errors say what happened and that work is safe (`'Could not send — try again'`, the unsupported-headset line). | 3.3.1 | Pass | Keep the pattern for the new surface-lost copy. |
| U3 | The eraser deletes whole marks; nothing says so. | 3.3.2 | Minor | Tooltip "Remove a whole mark". |

## Robust

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| R1 | Rive keys expose no name, role or state. `ViroText` keys expose only their visible word. | 4.1.2 | Critical | The native Rive Nitro surface must publish per-key name, role and state (selected, disabled, expanded) from the view model. Names in the copy doc §7. |
| R2 | Selected tool shown by fill only. | 1.4.1 | Open | Confirm the `.riv` adds a second cue (outline, check, label weight). The `XrRail` keys use a ring in the label colour for this; match it. |

## IME and keyboard focus

Master prompt §11 requires text editing, IME and keyboard focus to keep working. Requirements for the native board:

1. Entering text mode moves focus to one text field bound to the selected text record; the strip stays visible but drawing input pauses.
2. The system keyboard (or a paired keyboard) types into that field. Composition text from an IME shows inline with an underline before commit.
3. Escape, controller back or tapping outside commits and returns focus to the paper. It never discards typed text.
4. Focus is announced: "Text, editing" on entry, the record's content on exit.
5. Remote edits to the same record while it is being typed do not move the caret.

**Open:** which keyboard Horizon OS and PICO OS present to a Viro scene panel, and whether IME composition events reach React Native there. Neither has been tested.

## Reduced motion for Rive

- The `reducedMotion` boolean input exists on both `BoardChrome` and the question chrome.
- When true, state-machine transitions should cut instead of tween, and no element should pulse or loop. What the `.riv` actually does when the flag is set has not been checked. **Open.**
- The Ask "listening" state must stay perceivable with motion off (static icon change plus the status line).

## Open items

1. Rive key colours, focus treatment and selected cue (`.riv` not read).
2. Target-size fix for O1 (decision depends on research).
3. System reduced-motion source on Horizon OS and PICO OS.
4. Keyboard and IME path on both headsets.
5. Screen-reader support for Viro scenes on Horizon OS: unknown; check what the platform exposes before designing announcements.
6. Re-run contrast against passthrough for any chrome with `uiOpacity < 1`.
