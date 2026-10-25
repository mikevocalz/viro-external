# Whiteboard XR research plan

Status: **plan, not yet run.** No sessions have taken place. This file holds no findings, and nothing in the other `docs/design/**` files should be read as a research result. When sessions run, add a "Synthesis" section below with dated findings and the session log.

Skill applied: `user-research` (design plugin). Roster bar: IDEO, "every design choice traces to a research finding" (`prompts/ROSTER.md`). Until this plan runs, design choices in this folder trace to code, platform guidance or Mobbin references, and each one says which.

## What we are deciding

The native whiteboard (ADR 0001 D1, D2) and the Rive tool strip (D3) ship on Quest and PICO first. The current layout comes from code, not from people:

| Number in code | Value | Source |
| --- | --- | --- |
| Board panel distance | 2.6 m (arc radius) | MoyoLearn `packages/ui/xr/premium/spatialTokens.ts` `ARC_RADIUS` |
| Distance the metre tokens were sized for | 1.5 m | MoyoLearn `packages/ui/xr/spatial-tokens.ts` `spatialDistance.board` |
| Panel drop below eye line | 0.1 m, then removed again by `workspaceHeadOf`, so slots sit at eye height | `board-placement.ts`, `workspace-drag.ts` |
| Fallback eye height before a head pose arrives | 1.3 m (K-2 standing child) | `boardComposition.standingEyeHeight` |
| Board aspect | 16:10 landscape | `board-layout.ts` `BOARD_ASPECT` |

The 2.6 m vs 1.5 m split is the first thing to test: the tool keys were sized for 1.5 m and are drawn at 2.6 m (see `handoff/whiteboard-rive-panels.md`).

## Research questions

1. **Posture and board distance.** At what distance do learners write and read the board without leaning, squinting or turning their head? Compare 1.5 m, 2.0 m and 2.6 m. Does the answer change between ray input and near (poke) input?
2. **Pen vs controller vs hand.** With a tracked stylus (MusePenInput path), a controller ray and hand-tracking pinch, which input gives legible handwriting for digits and fractions? Where does each one fail: start-of-stroke, end-of-stroke, fine loops?
3. **Handedness.** The tool strip sits above the paper today (`TOOLBAR_BAND`), and the older rail sat on the left wing. Do left-handed learners cover the paper or the strip with their arm or ray? Does mirroring the strip help?
4. **Seated vs standing.** Does a seated learner reach the strip and the bottom edge of the paper? Meta's hands guidance says to avoid head-down tilt past ±15° for long periods (developers.meta.com/horizon/design/hands-ui-best-practices). Does the paper's bottom edge cross that while seated?
5. **Rive tool-strip discoverability.** Do learners find the colour well (it swaps the tool row for the ink row, `paletteOpen`), find Undo after a mistake, and understand the two-step Clear (`clearArmed`)? Do they read the strip as part of the board or as a separate object?

## Method

| Activity | Purpose | Participants | Time |
| --- | --- | --- | --- |
| Moderated usability test in headset | Questions 1, 2, 5 | 5-8 per age band that the product serves (`young`, `child`, `teen`, `adult` in `spatial-tokens.ts`) | 30 min per session |
| Within-subject distance comparison | Question 1 | Same participants, 3 distances, order counterbalanced | Inside the session |
| Handedness split | Question 3 | Recruit at least 2 left-handed participants per band | Inside the session |
| Seated / standing pair of runs | Question 4 | All participants, both postures | Inside the session |

Minors need guardian consent and a guardian present. Sessions stop at the first sign of discomfort, and every session ends with a comfort check.

## Session guide

1. Warm-up (5 min). Fit the headset, check the IPD, explain that we are testing the board, not them.
2. Context (5 min). How they do homework today: paper, tablet, whiteboard. Which hand they write with.
3. Tasks (15 min), each at each distance:
   - Write "3/4 + 1/8" on the board.
   - Highlight the denominator.
   - Change ink to red and circle the answer.
   - Undo the circle.
   - Clear the board, then cancel the clear.
   - Move the board somewhere more comfortable.
4. Reaction (3 min). Which distance felt best and why. What the strip's icons mean to them before they press anything.
5. Wrap-up (2 min). Comfort check. Anything we missed.

Probes: "What did you expect to happen?" "Where were you looking for that?" Do not name tools before the learner does.

## What to record

| Measure | How |
| --- | --- |
| Task success / failure / assisted | Moderator log |
| Time to first correct tool press | Device capture with timestamps |
| Mis-presses (wrong key, ink on the strip, ink while dragging) | Device capture; count per task |
| Stroke legibility | Two raters score the exported board PNG blind |
| Head pitch during writing | Head pose log from `onCameraTransformUpdate` |
| Comfort | Short self-report after each distance |

Device captures must be real headset recordings. Mockups and simulator frames do not count (`ROSTER.md` standing rule 5).

## Decisions this research feeds

| Decision | Current state | Owner |
| --- | --- | --- |
| Board distance token | 2.6 m in code, unvalidated | L6 |
| Tool key size floor | 4° floor in `spatial-tokens.ts`; Rive keys measure 2.2° x 1.9° at 2.6 m | L6, L3 |
| Strip position (above paper vs side rail) and mirroring | Above paper | L6, gate 2 |
| Seated layout | None | L6 |
| Default input when a pen is present | None | L5 |

## Synthesis

Not yet run.
