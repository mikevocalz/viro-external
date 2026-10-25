# Design critique, round 1

Skill applied: `design-critique` (design plugin), with `hz-immersive-designer` for comfort and spatial checks.

## Read this first

**These are pre-native captures.** No headset capture of the native whiteboard or native Rive panel exists yet. The only real captures available are three Quest stereo frames from 2025-09-25 in `/Users/mikevocalz/rive-panel-device-evidence/`, each 3664 x 1920:

| File | Time | What it shows |
| --- | --- | --- |
| `quest-rive-before-label-fix.png` | 17:18 | Rive question-panel probe ("Make one half"), before a label fix |
| `quest-rive-horizon-layout.png` | 17:55 | The same probe mid-drag, panel at the bottom of the view |
| `quest-rive9-hit-dots.png` | 18:32 | The same probe facing the viewer, ray on the first tile |

All three show the older Rive panel path (`ViroRivePanel` through `nitro-canvas-in-Vision` and `rive-android`), driving a fraction question, not the whiteboard. None shows the board, the tool strip, ink, or rounded corners from Workstream C. This round can only judge the Rive panel treatment those captures share with the board chrome: type, chrome, grip, status text and placement. Every finding below names the capture it comes from.

Stage: pre-native evidence, for the record. Round 1 does not clear any release gate.

## Overall impression

The last capture shows a readable panel with a clear title, four large answer tiles and an amber grip that says what it does. The first capture shows debug text floating in the room and overlapping itself, and the second shows a panel upside down at the bottom of the view during a move. The panel itself improved over 74 minutes; the scene around it was still a probe.

## Usability

| Finding | Capture | Severity | Recommendation |
| --- | --- | --- | --- |
| Two free-floating text lines ("Hold" and "Selected in") overlap each other at a size far larger than the panel's own type, with no backplate. | before-label-fix | Critical (for the probe) | Debug status never renders in the room on a learner build. If status is needed, it goes in the Rive `status` string inside the chrome. |
| Panel text and grip label render upside down and the panel sits at the bottom edge of the view while "Moving panel" is shown. | horizon-layout | Critical | Re-test the drag path on the native route. The board's drag (`useCarrierDrag`) composes yaw only; a roll or pitch flip like this must be impossible. Add a capture of a full drag to round 2. |
| "Selected in Rive: 0/4" floats under the grip, unanchored to any panel. | hit-dots | Moderate | Same as the first row. |
| A thin white line along the top of the first tile is the only hover cue where the ray lands. | hit-dots | Moderate | Hover needs a visible state on the whole target (fill change or ring), not a hairline. Meta's hands guidance and Apple's Eyes page both expect a clear hover effect. |
| Grip label "Hold to move" is clear and the grip sits under the panel, apart from the content. | hit-dots | Works | Keep. Same pattern is on the board (`'Hold to move'` / `'Moving board'`). |

## Visual hierarchy

- **What draws the eye first:** in hit-dots, the title "Make one half", then the tiles. Correct. In before-label-fix, the floating debug text wins, which is wrong.
- **Reading flow:** title, instruction line, tiles, "0/4 selected", "Show a hint". Logical.
- **Emphasis:** the instruction line ("Choose pieces. Tap a piece again to put it back.") is much smaller than the title and is hard to read even in the 1600 px downscale. "Show a hint" is light text on a mid-teal button and reads weaker than the tiles. The primary learner action (choose a tile) is emphasised correctly.

## Consistency

| Element | Issue | Recommendation |
| --- | --- | --- |
| Corners | Panel corners look slightly rounded; the tiles are more rounded than the panel. A board face drawn today sits on a square backing quad (`rive-board-panel.tsx`), so the two panels would not match. | Apply `radius.board` and `radius.toolKey` from `../system/panel-tokens.md` (proposed, gate 3). |
| Colour | Teal panel fill, amber grip. The grip amber (`#ffc168`) and the backing navy are raw literals, not theme tokens. | Tokenise (tokens file §3). |
| Type | Title, instruction and status text use three unrelated sizes; the status text matches neither. | Use the `type.*` steps. |

## Accessibility (from the captures)

- **Text readability:** the instruction line is below comfortable reading size at this distance. The tokens file lists the type floors; round 2 must show text at those sizes.
- **Targets:** the four tiles look large. The "Show a hint" button is roughly a third of a tile's height; measure it in the `.riv` before round 2.
- **Contrast:** light-on-teal button text looks low. The teal and button colours are inside the `.riv`, so the ratio could not be computed; sampling captured pixels would include lens and passthrough effects and was not attempted.

## Comfort and placement

- In before-label-fix the panel is above eye level and pitched; the viewer looks up at it. In hit-dots it sits near eye level and faces the viewer. The board's current placement code (`placeInFrontOf` flattened to the horizontal, slots at eye height) is the behaviour hit-dots shows.
- Passthrough is on in two of three captures. In horizon-layout the room is almost black (purple noise), so the panel was over a dark passthrough or a covered camera. Round 2 needs both a bright and a dim room.

## What works

- Large, evenly spaced answer tiles with clear labels.
- A grip separated from content, with an instruction on it.
- The ray visibly lands on a target.

## Priority recommendations

1. Remove free-floating debug text from every learner build; route status into the chrome's `status` line.
2. Make an upside-down or rolled panel impossible during a drag, and prove it with a drag capture.
3. Give hover a whole-target state.

## What round 2 must capture

Real headset recordings on Quest 3 (and PICO 4 Ultra when available) of the native board and native Rive panels. Mockups, simulator frames and editor screenshots do not count (`ROSTER.md` rule 5). For each item, record device, OS build, app commit SHA, distance and room lighting.

1. Board idle at its placed distance, front-on, with the tool strip, paper and grip all in frame.
2. The same at 30° and 60° off-axis, to show corner coverage and any halo (§9 colour gate).
3. Close-ups of each corner over bright and dim passthrough, scene panel and compositor panel side by side.
4. A full stroke with pen, controller and hand, including one stroke that leaves the paper and crosses the strip.
5. Tool switching: Pen, Highlighter, Eraser, colour well open and closed, Undo, Redo, two-step Clear and cancel.
6. Hover and pressed states on at least three keys, with the focus ring visible.
7. A complete drag of the board and release, filmed continuously.
8. Surface-lost recovery: force a surface loss and record the redraw.
9. Layer eviction: exceed the compositor layer budget and show the fallback looks identical.
10. Pen disconnect mid-stroke and reconnect.
11. Reduced motion on and off for the same tool change.
12. Text tool with the system keyboard, if the text tool has shipped.
13. Seated and standing, with the head-pose log.
14. The mid-grey and 50%-alpha colour-gate swatches over passthrough.

Reviewers named for round 2 (from `ROSTER.md`): Steve Ruiz (ink feel, tool model, drag-vs-draw), Mai-Linh Barry and Sergio Riquelme Sánchez (tool palette, empty and error states), Rasmus Andersson (board and label type at distance), the visionOS HIG and Meta Horizon OS guidance (ergonomics, corners, target sizes). Open items from round 2 block the release gate.
