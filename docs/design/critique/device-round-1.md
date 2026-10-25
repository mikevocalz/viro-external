# Design critique, device round 1: Baseline vs Candidate

Skill applied: `design-critique` (design plugin), with `hz-immersive-designer` for comfort and spatial checks.

This round judges real headset captures from Round 1 of `../../validation/session-plan.md` (flags off, Baseline vs Candidate, blind A/B). `round-1.md` covered older pre-native captures and does not count here.

**State: blocked, no captures yet.** No headset is connected. Every item below says so. Mockups, simulator frames, editor screenshots and casting stills do not unblock an item (`prompts/ROSTER.md` rule 5).

## Merge gate

Each item that is open or blocked holds back the merge recommendation for the Viro PR stack. The recommendation is written only when every row in the table below reads "pass" or has a recorded, reviewed exception.

**Merge recommendation: none.** Blocked on captures.

## Inputs per item

Each item compares the same capture taken on Baseline and on Candidate, same headset, same room light, same framing. Record for each pair: headset, OS build, both commits, build letter, the session key result, room light, distance, capture file names.

## Items

| # | Area | What to compare | Session row | Quest 3S | PICO 4 Ultra |
| --- | --- | --- | --- | --- | --- |
| 1 | First impression | Each of the three real scenes, front-on: what draws the eye first, and whether it is the same on both builds | R1.1 | blocked: no captures yet | blocked: no captures yet |
| 2 | Stability | Head-turn video of each scene: panel swim, judder or jumps | R1.1 | blocked: no captures yet | blocked: no captures yet |
| 3 | External surface | First frame and steady playback on the external-surface panel | R1.1 | blocked: no captures yet | blocked: no captures yet |
| 4 | Video tone | Near-black ramp step count, mid-grey cast, skin tones | R1.2 | blocked: no captures yet | blocked: no captures yet |
| 5 | Translucent panel | 0.9-opacity panel over passthrough: text reading, show-through, edge halo, front-on and 30° | R1.3 | blocked: no captures yet | blocked: no captures yet |
| 6 | Corners | Corner rounding on every panel in the three scenes; same token, same look on both builds | R1.1, R1.3 | blocked: no captures yet | blocked: no captures yet |
| 7 | Type | Every text step in the scenes against the `type.*` scale; nothing new below 1.0° | R1.1, R1.3 | blocked: no captures yet | blocked: no captures yet |
| 8 | Performance felt | Mike's checkpoint answers alongside the R1.4 trace: anything visible before the numbers flag it | R1.4 | blocked: no captures yet | blocked: no captures yet |
| 9 | Many surfaces | Scene at 4 external surfaces: black or frozen surfaces, visible slowdown | R1.5 | blocked: no captures yet | blocked: no captures yet |
| 10 | Lifecycle | Any of the 20 background/resume and headset off/on cycles that came back wrong or late | R1.6 | blocked: no captures yet | blocked: no captures yet |
| 11 | Comfort | Comfort ratings and any stop, per build | All | blocked: no captures yet | blocked: no captures yet |
| 12 | Blind result | Did Mike notice a difference, and did he guess the new build? | Comparison questions | blocked: no captures yet | blocked: no captures yet |

## Per-item write-up

Fill one block per item once its captures exist. Keep the Baseline and Candidate observations side by side; a finding names the capture that shows it.

```
### Item <n>: <area>, <headset>

Baseline (<file>):
Candidate (<file>):
Difference seen: yes / no
Mike said:
Severity: blocks merge / fix before release / note / none
Recommendation:
```

Severity rule: a Candidate that is worse than Baseline on any item, with the flags off, blocks the merge. That is the purpose of Round 1. A Candidate that is better is noted but does not unblock anything else.

## What works

Not yet assessable: no captures.

## Reviewers

From `prompts/ROSTER.md`: Steve Ruiz, Mai-Linh Barry and Sergio Riquelme Sánchez (canvas and states), Rasmus Andersson (type at distance), Ryan Pavlik (layers, alpha, corners), the visionOS HIG and Meta Horizon OS guidance (ergonomics, targets). Each reviewer signs against the captures, not this summary.
