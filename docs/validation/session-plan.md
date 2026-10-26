# In-headset session plan: Round 1 and Round 2

Skill applied: `user-research` (design plugin), with `hz-immersive-designer` for comfort checks and `expo-horizon` for the Quest build. Owner: L6, for the V1 lane. Procedures and pass/fail rows live in [DEVICE_VALIDATION.md](../DEVICE_VALIDATION.md); this file covers the people side: who wears the headset, what they do, what gets recorded, and what they are asked afterwards.

State: **not yet run.** No headset is connected and no capture exists. Every result field below is empty on purpose.

## Scope

Supported headsets: **Meta Quest 3S** and **PICO 4 Ultra** (decided). Every session runs once per headset.

| Round | Flags | Builds compared | Question it answers |
| --- | --- | --- | --- |
| 1 | `nativeBoard = false`, `nativeRive = false` | Baseline vs Candidate | Did the PR stack change anything a person can see or feel with every new path switched off? |
| 2 | `nativeBoard = true`, `nativeRive = true` | Candidate only, flag off then on | Do the native board and native Rive panel hold up in use? |

- **Baseline**: the app built from the commit before the Viro PR stack.
- **Candidate**: the app built from the head of the stack.

Round 1 is a no-regression check, so the right outcome is "no difference". Round 2 has no baseline because the native paths do not exist before the stack.

## Participant

| Field | Value |
| --- | --- |
| Wears the headset | Mike |
| Operator | A second person when available; otherwise the agent driving `adb` from the Mac |
| Sample size | 1 |
| Seating | Seated and standing, half the tasks each, swapped between headsets |

With one participant who also built the feature, this is an expert walkthrough with timed tasks, not a usability study. Results say "Mike, on this build, on this day". Do not generalise them to learners. The learner study stays in `../design/research/whiteboard-xr-research.md`.

## Blind A/B for Round 1

Baseline and Candidate share one package id, so only one can be installed at a time. Mike should not know which one is on.

1. Before the session, the operator flips a coin for each headset and writes the result to `session-<date>-key.txt` on the Mac: `Quest 3S: first = Baseline|Candidate`, same for PICO. Mike does not open this file until the debrief.
2. The operator labels the two installs **Build A** (first) and **Build B** (second). Only the letter is spoken in the headset.
3. Uninstall before every install (`adb uninstall`, then `adb install`), so the Android launcher, recents and version string give no hint. Hide the in-app version label for the session if the app shows one; if it cannot be hidden, note that the blind was broken.
4. Mike runs every Round 1 task on Build A, takes the headset off, waits while the operator swaps installs, then runs the same tasks on Build B.
5. After both, Mike answers the comparison questions (below) before the key is read.

Where the blind breaks: if the operator is the agent, there is no human to hide the coin result from Mike except the file itself, and Mike can see the terminal. Record "blind: yes / broken (reason)" in the session log. Round 2 is not blind: the flag states are the point of the test.

## Builds and install

### Quest 3S

Flavor and install follow [DEVICE_VALIDATION.md §1](../DEVICE_VALIDATION.md). Summary for the session:

- Install only `questDebug` for functional tasks and `questRelease` for the R1.4 soaks. Never install a `mobile*` variant on the headset; expo-horizon's quest variants must not run on phones, and the mobile variants must not run on Quest.
- `supportedDevices` in MoyoLearn's `expo-horizon-core` config must include `quest3s`. It did when `DEVICE_VALIDATION.md` was written (`'quest2|questpro|quest3|quest3s'`); check again on the session's commit.
- After any change to the `expo-horizon-core` plugin options, run `npx expo prebuild --clean` before building.
- Uninstall, build with `./gradlew :app:assembleQuestDebug --no-daemon`, record the real exit code, install the APK path Gradle printed.
- Expo Go is not used; the session needs a development or release build.

### PICO 4 Ultra

- Install `picoDebug` or `picoRelease`. PICO is configured through `@expo-pico/core`, not expo-horizon.
- Same uninstall, build, exit-code and install rules as Quest.

### Render-quality settings

Eye-buffer scale and foveation are developer-only build settings. Mike does not pick them in the app. The defaults for both rounds are eye-buffer scale **1.3** and foveation **LOW, dynamic**, until R1.4 evidence says otherwise (see `../design/handoff/whiteboard-rive-panels.md`, "Render-quality defaults"). The a11y legibility pass runs extra builds at other values; those builds are labelled by value, not blinded.

## Capture

| Headset | Stills | Video | Live view for the operator |
| --- | --- | --- | --- |
| Quest 3S | `metavr capture screenshot --method metacam -o <file>.png` (the metavr CLI's default method; `screencap` is the alternative). Default size is 1024 x 1024; pass `--width`/`--height` for corner and text close-ups. | Headset's built-in recorder (started from the headset UI), then `adb pull`. The on-device folder is not confirmed for Quest 3S on the session's OS build; run `adb shell ls /sdcard/Oculus` on the first session and write the path here. | Casting through Meta Quest Developer Hub (`metavr casting` starts or stops it). Casting is for watching only; it is not evidence. |
| PICO 4 Ultra | Headset's built-in screenshot, then `adb pull` | Headset's built-in screen recorder, then `adb pull` | PICO's casting from the headset UI |

The PICO capture paths and menu names are **not verified** for the session's OS build. Confirm on the first run and record them here. Do not substitute `scrcpy` or `adb shell screenrecord` for the evidence files without recording that choice: neither has been shown to capture the compositor layers on either headset, and a capture that silently drops the B2 layer would pass a corner check it should fail.

Every capture file name: `<headset>-<round>-<build letter or flag state>-<row>-<take>.<ext>`, for example `quest3s-r1-A-R1.3-1.mp4`.

Log alongside every task: `adb logcat -v threadtime -s WhiteboardRenderer NativePanelsRive` plus Viro's tags, and the run fields in [DEVICE_VALIDATION.md §2](../DEVICE_VALIDATION.md).

## Session timing

Comfort rules from `hz-immersive-designer`: break every 20 to 30 minutes. Plan:

| Block | Length | Content |
| --- | --- | --- |
| Set-up | 10 min | Fit, IPD, guardian, passthrough on, room light recorded (bright, then dim) |
| Round 1, Build A | 25 min | R1.1 to R1.3, R1.6 |
| Break, swap install | 10 min | Headset off |
| Round 1, Build B | 25 min | Same tasks |
| Comparison questions | 10 min | Before the key is read |
| R1.4 and R1.5 soaks | per DEVICE_VALIDATION | Headset worn but idle during soaks; Mike can take it off between checkpoints |
| Round 2 | two 25 min blocks with a break | Round 2 tasks |
| Debrief | 10 min | Key read, notes reviewed |

Stop the session at the first report of nausea, eye strain or headache, and log the time and task.

## Round 1 tasks (flags off, Build A then Build B)

| Row | Task for Mike | What the operator watches and captures | Questions after the task |
| --- | --- | --- | --- |
| R1.1 | Open three real scenes in turn, including one with an external surface (video or camera feed on a panel). Look at each for 30 s, turn your head left and right, walk one step. | Video of each scene; frame drops or judder; any panel that jumps, flickers or swims; the external surface's first frame time | 1. Did anything look different from how you expect this scene to look? 2. Did any panel flicker, jump or lag behind your head? 3. Rate comfort 1 to 5. |
| R1.2 | Play the test video: near-black ramp, then mid-grey field, then skin tones. Watch each section to the end. | Video of the panel; banding in the ramp; crushed or lifted blacks; colour cast on mid-grey; skin tones that look grey or orange | 1. In the dark ramp, how many steps could you tell apart? 2. Did the grey look neutral? 3. Did the faces look natural? |
| R1.3 | Find the 0.9-opacity panel over passthrough. Read its smallest line of text out loud. Look at each corner up close. | Still of the panel front-on and at 30° off-axis; Mike's reading (word errors counted); any halo on corners or text | 1. Was any word hard to read? Which? 2. Could you see the room through the panel enough to be distracting? 3. Any light or dark rim on the edges? |
| R1.4 | Soaks per DEVICE_VALIDATION (release build). Mike wears the headset at the start and at each checkpoint. | Frame-time trace, thermal state, CPU/GPU level, dropped frames, as that procedure defines | At each checkpoint: 1. Has anything started to stutter or blur since the last check? 2. Is the headset uncomfortably warm? |
| R1.5 | Open 1, then 2, then 4 external surfaces. Look at each new one for 10 s. | Memory reading at each step (procedure in DEVICE_VALIDATION); video of the scene at 4 surfaces | 1. Did adding surfaces slow anything you could see? 2. Did any surface go black or freeze? |
| R1.6 | Press the system button to leave, come back. Repeat 10 times. Then take the headset off, wait for the screen to sleep, put it back on. Repeat 10 times. | Count of returns where any panel is blank, wrong, or slow (>2 s) to reappear; logcat across all 20 cycles | 1. Did anything come back wrong or late? Which cycle? 2. Did you lose anything you had drawn or opened? |

### Comparison questions (after both builds, before the key)

1. Did you notice any difference between Build A and Build B? Where?
2. If yes, which build was better on that point, and how sure are you (guess / fairly sure / certain)?
3. Did either build feel less comfortable?
4. Which build do you think is the new one, and why?

A "no difference" answer with matching captures is a pass for Round 1. A difference Mike is "fairly sure" or "certain" about opens a finding, even if the captures do not show it yet.

## Round 2 tasks (flags on; Candidate)

Run each task once with the flag off, then with it on, on the same install.

| Task for Mike | Captures | Questions after the task |
| --- | --- | --- |
| Draw five quick strokes, then write a word slowly, with the controller ray. Repeat with hand pinch. | Video at 72 Hz or the headset's rate; ink latency read per DEVICE_VALIDATION (the device-side measurement, not Mike's estimate) | 1. Did the ink keep up with your hand? 2. Did the line start where you aimed? 3. Did the line feel smooth or jagged? |
| Draw while the operator makes remote edits to the same document from a second client. | Video; both clients' logs | 1. Did your strokes and the other person's appear in the right order? 2. Did anything vanish, duplicate or jump? |
| Look at the Rive panel's mid-grey swatch and 50 % alpha swatch over passthrough. The operator shows the same artboard in the Rive editor on the Mac next to the headset casting. | Still of each swatch; close-ups of all four corners at 0°, 30° and 60° off-axis | 1. Does the grey match what you see in the editor? 2. Does the half-transparent swatch look half-transparent? 3. Any halo on the rounded corners? |
| Look at the same panel token on the quad layer, the cylinder layer, the scene panel and the eviction fallback, one after another, from the same spot. | Stills from one fixed position; corner measurement per `../design/system/panel-tokens.md` "On-device measurement" | 1. Do all four corners look the same? 2. Which one, if any, looks different? |
| Aim into each transparent corner of the board and the Rive panel, then just inside the edge, and press. | Video with the ray visible; logcat for hit events | 1. Did anything react when you pressed in the empty corner? 2. Did anything fail to react just inside the edge? |
| Operator forces a compositor eviction (exceed the layer budget) while Mike watches the panel. | Continuous video across the eviction and the return | 1. Did you see the panel change, jump or flash? |
| Leave and return 10 times (system button), take the headset off and on 10 times, and the operator reloads JS 5 times. | Live swapchain and surface counts per DEVICE_VALIDATION X6 at baseline and after each cycle; logcat for the STOPPING state | 1. Did anything come back wrong? Which cycle? |
| None for Mike: the operator reads the log. | The Rive mode line Rive logs on each headset (interlock, atomic, MSAA or other) | n/a; record the mode per headset in DEVICE_VALIDATION R3 |

## Debrief

1. Read the Round 1 key. Record whether Mike's guess in comparison question 4 was right.
2. For each finding, write: headset, round, build or flag, row, capture file, Mike's words, severity (blocks merge / fix before release / note).
3. Write results into [DEVICE_VALIDATION.md §5](../DEVICE_VALIDATION.md) and the design files' "Device findings" sections. Do not mark a row passed from Mike's answers alone; a row passes on its capture or log (`prompts/ROSTER.md` rule 5).

## Session log

| Field | Quest 3S | PICO 4 Ultra |
| --- | --- | --- |
| Date | not yet run | not yet run |
| Builds (commit, variant) | | |
| Blind held | | |
| Room light (bright, dim) | | |
| Seated / standing per task | | |
| Breaks taken | | |
| Comfort stop | | |
| Capture paths confirmed | | |
