# First headset session: checklist for Mike

[Device pass](2026-10-device-pass.md) · [Performance](PERFORMANCE.md)

This first session runs Round 1 on one headset: R1.1, R1.3, R1.6 and the R1.4 cells that can run today (runtime default refresh rate, Baseline 1.0 / MEDIUM and Candidate 1.3 / LOW). R1.2 and R1.5 wait for a probe route, and Round 2 waits for an app commit with the native-panels packages. Do Quest 3S first, then repeat on PICO 4 Ultra in a second session.

Time on one headset: about 2 hours, 52 minutes of it with the headset on.

## Before the session (agent)

- [ ] Disk freed and all four APKs built: `scripts/device/build-stack.sh {baseline,candidate} {quest,pico}`. Each prints a `build-<platform>.txt`; check that the Candidate one says `eye-buffer log string=present` and the Baseline one says `absent`.
- [ ] OVR Metrics Tool installed on the Quest 3S (Meta Horizon Store or Meta Quest Developer Hub).

## Plug in (Mike)

- [ ] Headset charged to 50% or more. Unplug the charger once adb is authorised; cells run on battery.
- [ ] USB-C data cable from the headset to the Mac. A charge-only cable shows nothing in `adb devices`.
- [ ] Put the headset on and accept "Allow USB debugging" (tick "always allow").
- [ ] Reboot the headset once (`adb reboot`, or from the power menu). This clears any `debug.oculus.*` override left from earlier work.
- [ ] Quest: guardian set, room lit evenly. Passthrough rows need a normal room; critique round 1 also asked for one bright and one dim room for Round 2, so note which this is.
- [ ] PICO only: Settings > Developer > Performance Tuner: confirm there is no profile for MoyoLearn and tell the agent (it records `PERF_TUNER_OFF=yes`). Settings > Developer > Metrics HUD: on.

Agent then runs `scripts/device/check-overrides.sh`; it must print `RESULT clean`.

## Session

Each block: agent installs and starts capture, Mike does the task, agent stops capture. Alternate stacks as listed.

| # | Stack | Agent runs | Mike does | Headset on |
| --- | --- | --- | --- | --- |
| 1 | Baseline | `install.sh …/baseline/moyolearn-baseline-quest-release.apk`, then `capture-start.sh R1.1-quest-baseline` | Open the app. Visit `xr-layout-probe`, `xr-question-probe`, `rive-panel-probe` (the agent tries `adb shell am start -a android.intent.action.VIEW -d moyo://<route>` first; the app's scheme is `moyo` in `app.config.ts`, and whether expo-router opens these routes from a link is confirmed here). In each, record 20 s of the headset view, looking at the panel straight on, then from 30° to the side. Say out loud or write anything that looks off | 5 min |
| 2 | Baseline | `capture-stop.sh`, then `capture-start.sh R1.3-quest-baseline` | In `rive-panel-probe` over passthrough: record the panel close up, edges and any small text. Write how strong the panel looks against the room and whether edges shimmer | 3 min |
| 3 | Baseline | `capture-stop.sh`, then `capture-start.sh R1.4-quest-baseline-default-s1.0-MEDIUM` | Open the R1.4 scene (agent names it after block 1), stand still facing it, hands off the controllers, 10 minutes | 10 min |
| 4 | Baseline | `capture-stop.sh`, then `capture-start.sh R1.6-quest-baseline` | 10 cycles: press the Meta/home button, wait 5 s, return to the app; then take the headset off, wait for the screen to sleep (about 15 s), put it back on. Say "crash" if the app ever closes or goes black | 8 min |
| rest | either | `capture-stop.sh` | Headset off, 5 min rest | 0 |
| 5 | Candidate | `install.sh …/candidate/moyolearn-candidate-quest-release.apk`, then repeat blocks 1 to 4 with `candidate` in each label (R1.4 label: `…-candidate-default-s1.3-LOW`) | Same as blocks 1 to 4, same order, same angles | 26 min |
| 6 | both | `capture-stop.sh` | Write one paragraph comparing Baseline and Candidate for R1.1 and R1.3: panel sharpness, text edges, colour against the room, anything that moved or flickered | 0 |

The 5-minute rest before switching stacks lets the headset cool so the Candidate R1.4 cell does not start warmer than the Baseline one. Use the same rest between any two R1.4 cells in later sessions.

## After the session (agent)

- [ ] Every run directory has `summary.txt` with `crash_lines`, an OVR Metrics CSV (Quest), and an `eye-buffer.txt`. Candidate runs must contain `Eye 0: recommended …, rendering …`.
- [ ] `refresh-rate.txt` lists the rates the runtime offers; copy them into device pass §5.
- [ ] Fill in the matrix rows and PERFORMANCE.md cells from the files; link each run directory.
- [ ] Mike's recordings and written notes are linked from R1.1 and R1.3. Without them those rows stay unverified.
