# Design docs: native whiteboard, native Rive and rounded panels

Lane L6 of `docs/adr/0001-native-whiteboard-rive-panels.md`. Reviewers: `prompts/ROSTER.md`. Written 2026-10-24 against MoyoLearn `feat/business-photocraft-engine-admission` and viro-external `feat/native-whiteboard-rive-panels`.

## Files

| Step (master prompt §3.1) | File | State |
| --- | --- | --- |
| 1 user-research | [research/whiteboard-xr-research.md](research/whiteboard-xr-research.md) | Plan, not yet run |
| 2 design-handoff | [handoff/whiteboard-rive-panels.md](handoff/whiteboard-rive-panels.md) | From code; open items listed |
| 3 design-system | [system/panel-tokens.md](system/panel-tokens.md) | Radius table proposed, awaiting gate 3 |
| 4 ux-copy | [copy/whiteboard-copy.md](copy/whiteboard-copy.md) | Existing strings reused; new strings marked |
| 5 accessibility-review | [a11y/whiteboard-a11y.md](a11y/whiteboard-a11y.md) | Review of token values; not tested on device |
| 6 design-critique | [critique/round-1.md](critique/round-1.md) | Pre-native captures only; round 2 capture list included |
| 7 code-review | n/a here | Runs per PR |
| 8 frontend-design | this file | **Not applicable**: no 2D or web surface changed in this lane |

Device validation (lane S4, §4.1/§4.2), added 2026-10-25. Nothing below has run on a headset yet; supported headsets are Quest 3S and PICO 4 Ultra.

| Step | File | State |
| --- | --- | --- |
| user-research | [../validation/session-plan.md](../validation/session-plan.md) | Round 1 (flags off, blind Baseline vs Candidate) and Round 2 (flags on) session plan; not yet run |
| design-handoff | [handoff/whiteboard-rive-panels.md](handoff/whiteboard-rive-panels.md) "Render-quality defaults", "Device findings" | Defaults recorded (eye-buffer 1.3, foveation LOW dynamic, developer-only); findings not yet run |
| design-system | [system/panel-tokens.md](system/panel-tokens.md) §7 "On-device measurement" | Procedure written; delta table not yet run |
| ux-copy | [copy/whiteboard-copy.md](copy/whiteboard-copy.md) "Render-quality setting", "Wording for the validation report" | Setting is developer-only, no copy; report wording rules |
| accessibility-review | [a11y/device-pass.md](a11y/device-pass.md) | Plan and empty results; not yet run |
| design-critique | [critique/device-round-1.md](critique/device-round-1.md) | Every item blocked: no captures yet; blocks the merge recommendation |
| frontend-design | this file | **Not applicable**: the device lane changes no 2D or web surface |

Mobbin passes (§3.2), all run through the Mobbin MCP on 2026-10-24:

| Screen | File |
| --- | --- |
| Whiteboard board panel | [mobbin/whiteboard-board-panel.md](mobbin/whiteboard-board-panel.md) |
| Rive tool strip | [mobbin/rive-tool-strip.md](mobbin/rive-tool-strip.md) |
| Stroke style sheet | [mobbin/stroke-style-sheet.md](mobbin/stroke-style-sheet.md) |
| Text and image insert | [mobbin/text-and-image-insert.md](mobbin/text-and-image-insert.md) |
| Pages / board navigator and export | [mobbin/pages-navigator-export.md](mobbin/pages-navigator-export.md) |
| Panel states | [mobbin/panel-states.md](mobbin/panel-states.md) |
| Pen and input settings | [mobbin/pen-input-settings.md](mobbin/pen-input-settings.md) |

Pass 2 on 2026-10-25 re-ran the board panel, tool strip and panel states queries and added a "Held up on device?" section to each (not yet run). The render-quality setting has no Mobbin pass: it is a developer-only build setting with no screen.

## Findings that need a decision

1. **Tool keys are too small at the board's real distance.** The board hangs at 2.6 m (`ARC_RADIUS`), but the metre tokens were sized for 1.5 m. Rive keys measure 2.2° x 1.9°, under Meta's 2.5°-3° collider and MoyoLearn's own 4° floor. See a11y O1.
2. **Board aspect.** Every shipping file uses 16:10; the ADR call site uses 2048 x 2867 (5:7). See handoff "Aspect".
3. **Corner radius.** MoyoLearn uses 0.022 m, viro-external 0.06 m, the board face 0. Proposed: angle-locked radius (gate 3).
4. **Arc geometry.** MoyoLearn's side slots sit at 34° with 3° toe-in; viro-external's `worldSlot` uses 28° and none.
5. **Typeface.** The roster names Inter; neither repo bundles it.
6. **`reducedMotion`** is hard-coded to `true` instead of read from a setting.
