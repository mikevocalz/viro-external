# Accessibility device pass: whiteboard and Rive panels

Skill applied: `accessibility-review` (design plugin), with `hz-immersive-designer` for the spatial floors. Standard: WCAG 2.1 AA where it maps to a headset; the 1.0° text floor and target angles come from `../system/panel-tokens.md`.

This is the plan for checking on a headset what `whiteboard-a11y.md` reviewed from code. State: **not yet run.** Every result cell is empty. Sessions run inside `../../validation/session-plan.md`; Mike is the only wearer, so these results describe one person with typical vision, not the range of learners.

Headsets: Quest 3S and PICO 4 Ultra.

## 1. Smallest-text legibility by render setting

Eye-buffer scale and foveation are developer-only build settings (`../handoff/whiteboard-rive-panels.md`, "Render-quality defaults"). The default is 1.3 and LOW dynamic. This matrix shows what each step costs in text, so a change after R1.4 is made with the legibility price known.

Content for each cell, read out loud by Mike from the placed distance, front-on, then at the edge of the view (head still, eyes turned about 20°):

- Board text at QuickDraw `s`, `m`, `l`, `xl` on the paper at 2.6 m (0.43°, 0.56°, 0.77°, 1.03°; tokens §4).
- The Rive tool-strip key labels at 2.6 m.
- The question panel's instruction line.
- The status line (`status` string) with one sentence of copy.

Record word errors per line and whether Mike had to lean in. Capture a still of each cell with the same framing.

Builds are labelled by value, not blinded.

| Eye-buffer scale | Foveation | Headset | Smallest board size read without error (front-on) | Same, at 20° eccentricity | Key labels | Question instruction | Status line | Capture |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | LOW | Quest 3S | not yet run | | | | | |
| 1.0 | MEDIUM | Quest 3S | not yet run | | | | | |
| 1.3 | LOW | Quest 3S | not yet run | | | | | |
| 1.3 | MEDIUM | Quest 3S | not yet run | | | | | |
| 1.0 | LOW | PICO 4 Ultra | not yet run | | | | | |
| 1.0 | MEDIUM | PICO 4 Ultra | not yet run | | | | | |
| 1.3 | LOW | PICO 4 Ultra | not yet run | | | | | |
| 1.3 | MEDIUM | PICO 4 Ultra | not yet run | | | | | |

Pass: every line the learner must read (key labels, instruction, status) reads without error at 1.3 / LOW on both headsets. Board text below 1.0° is expected to fail; that is finding P3 in `whiteboard-a11y.md`, and this matrix measures how far off it is.

PICO's foveation levels may not be named LOW and MEDIUM. Map them to the nearest PICO level, write the PICO name in the row, and say how the mapping was chosen.

## 2. Contrast over passthrough

Code-side ratios in `whiteboard-a11y.md` assume an opaque background. Over passthrough, the real background is the room.

| Check | Room | Method | Pass | Quest 3S | PICO 4 Ultra |
| --- | --- | --- | --- | --- | --- |
| Label on rail (`#FFFDF7` on `#262420`) | Bright, then dim | Mike reads the labels; still captured | Reads without error in both rooms | not yet run | not yet run |
| 0.9-opacity panel text (R1.3) | Bright window behind the panel, then a dark wall | Mike reads the smallest line; still at 0° and 30° | Reads without error; the room does not show through enough to break letter shapes | not yet run | not yet run |
| Ink colours on paper | Bright | Mike names each of the seven ink colours from one stroke each | Every colour named; yellow is expected to be the weak one (P1) | not yet run | not yet run |
| Focus ring (`#3B6DF6`) on a key | Bright, then dim | Mike says which key has focus | Identified every time | not yet run | not yet run |

Ratios are not computed from captured pixels: the capture includes lens and passthrough processing, so a pixel sample is not the colour the eye saw. Results here are reading tasks, not ratios.

## 3. Video blacks

| Check | Method | Pass | Quest 3S | PICO 4 Ultra |
| --- | --- | --- | --- | --- |
| Near-black ramp (R1.2) on a video panel | Mike counts distinguishable steps; still captured in a dim room | Same count on Baseline and Candidate, and no step visibly crushed to the panel's black | not yet run | not yet run |
| Captions or subtitles over a dark frame, if the video has them | Mike reads them | Readable without error | not yet run | not yet run |

## 4. Rive `reducedMotion`

`reducedMotion` is hard-coded `true` in `tutor-xr-screen.native.tsx:844` and `tutor-question-panel.tsx:64`, and `false` in `xr-layout-probe.tsx:307` (finding O3 in `whiteboard-a11y.md`). So on today's tutor screen the Rive chrome always runs reduced motion, whatever the headset setting says.

| Check | Method | Pass | Quest 3S | PICO 4 Ultra |
| --- | --- | --- | --- | --- |
| Current behaviour | Change tool and open the ink row on the tutor screen; record video | Matches the hard-coded `true`: no state-machine transition animation | not yet run | not yet run |
| System setting reaches the app | Turn the headset's reduce-motion option on and off (if it has one); log the value React Native's `AccessibilityInfo.isReduceMotionEnabled()` returns | The returned value follows the setting | not yet run | not yet run |
| After O3 is fixed | Same tool change with the setting on, then off | Motion only when the setting is off | blocked: O3 not fixed | blocked: O3 not fixed |

Whether either headset's OS exposes a reduce-motion setting through that API is unverified. If it does not, write "no system setting" in the row; the fix then needs an in-app toggle.

## 5. Findings

| # | Headset | Section | Finding | Capture | Severity |
| --- | --- | --- | --- | --- | --- |
| | not yet run | | | | |
