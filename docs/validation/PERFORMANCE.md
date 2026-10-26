# Performance: Baseline vs Candidate, October 2026

[Device pass](2026-10-device-pass.md) · [First session checklist](first-session-checklist.md) · [Native panels performance plan](../PERFORMANCE.md)

This file holds the R1.4 and R1.5 numbers for the device pass. Nothing has been measured. Every table cell below is "not yet run", and a cell only gets a number that came out of a CSV, a trace or the sampler of a run listed in the matrix. The commit that rendered #112's eye buffers at 1.3x quotes "about 17% GPU at 72 Hz" on a Quest 3S; that number is the commit's claim, it was not reproduced here, and it is not used below.

## Sources for each metric

| Metric | Quest 3S | PICO 4 Ultra |
| --- | --- | --- |
| APP T (app GPU time, µs) | OVR Metrics `APP T`, CSV stat `app_gpu_time_microseconds` | No documented equivalent in the Metrics HUD list; from the Perfetto `gpu.renderstages` track if the runtime exposes it, otherwise "not available" |
| GPU U | `GPU U`, `gpu_utilization_percentage` | HUD `GPU U` (live only) |
| Stale frames | `STALE`, `stale_frame_count`; `C STALE`, `stale_frames_consecutive` | No documented equivalent; "not available" |
| FPS | `FPS`, `average_frame_rate`; `DRR`, `display_refresh_rate` | HUD `FPS`, `DRR` |
| Thermal | `power_level_state` (POW L: 0 normal, 1 save, 2 danger), `battery_temperature_celcius`, `cpu_level`, `gpu_level`; sampler `Thermal Status` | HUD CPU and GPU temperature, `B TEM`, `CPU L`, `GPU L`; sampler `Thermal Status` |
| EBW / EBH | `EB W`/`EB H`, `eye_buffer_width`/`eye_buffer_height`; Candidate also logs `Eye %u: recommended …, rendering …` | HUD `EBW`/`EBH`; Candidate log line |
| Foveation level | `FOV`, `foveation_level` | HUD `FRL` (-1 off, 0 low, 1 medium, 2 high, 3 top high) |
| RSS | `app_rss_MB`; sampler `TOTAL RSS` from `dumpsys meminfo` | HUD `RSS`; sampler `TOTAL RSS` |

Sources: Meta, "OVR Metrics Tool stats definitions" (developers.meta.com/horizon/documentation/native/android/ts-ovrstats) and "OVR Metrics Tool" (…/ts-ovrmetricstool), read 2026-10-25, for every Quest name, CSV stat id, the broadcast receiver `com.oculus.ovrmonitormetricsservice/.SettingsBroadcastReceiver`, the `ENABLE_CSV`/`DISABLE_CSV`/`ENABLE_STAT` actions and the CSV directory `/sdcard/Android/data/com.oculus.ovrmonitormetricsservice/files/CapturedMetrics/`. PICO, "Metrics HUD" and "Monitor device performance" (developer-cn.picoxr.com/document/unity/metrics-hud, …/monitor-device-performance), for the HUD names and the statement that the HUD "does not support exporting raw performance data". The legacy PICO Metrics Tool page (sdk.picovr.com/docs/MetricsTool/en/chapter_one.html) lists GPU U, CPU U, FPS, A MEM, FRL, EBH and U MEM, with no export.

On PICO, GPU U, FPS, EBW/EBH and FRL are read off a headset recording of the HUD, so they are spot readings, not p50/p95. The table says which.

## Procedure

1. Reboot the headset. System properties do not persist over reboots (Meta, System properties page), so this clears any `debug.oculus.*` left from an earlier session.
2. Battery at 50% or more, not charging, room temperature recorded. Charging and a warm start both move thermal numbers; these limits are mine, set so cells are comparable, not taken from a doc.
3. `scripts/device/install.sh <apk>` for the stack under test. The script checks the installed APK's SHA-256.
4. Quest: OVR Metrics Tool installed. PICO: Settings > Developer > Metrics HUD on, and Performance Tuner confirmed empty for `com.moyolearn.app`.
5. `scripts/device/capture-start.sh R1.4-<device>-<stack>-<refresh>-s<scale>-<fov>`. It refuses to start if an override is active.
6. Launch the app after capture starts (the OVR Metrics CSV is written per app run), open the R1.4 scene, put the headset on, and hold still facing the scene for 10 minutes. Do not touch controls.
7. `scripts/device/capture-stop.sh`.
8. Headset off for 5 minutes before the next cell.
9. The first 30 seconds of each CSV are dropped (scene load). p50 and p95 are computed over the remaining rows; the row count goes in the table.

Order: alternate stacks (Baseline, Candidate, Baseline, …) so drift in room or battery temperature does not land on one stack.

## R1.4 results

One block per device. Columns are Baseline vs Candidate at the same refresh rate. Cells that need §6.2 are listed in the matrix and stay empty here until they run. "Highest" cells are Candidate only, built with `android.openxr.displayRefreshRate: "highest"` (device pass §5).

### Quest 3S, runtime default refresh rate

| Metric | Baseline 1.0 / MEDIUM | Candidate 1.0 / LOW | Candidate 1.0 / MEDIUM | Candidate 1.3 / LOW | Candidate 1.3 / MEDIUM |
| --- | --- | --- | --- | --- | --- |
| Refresh rate (Hz, from `[XR-DIAG]` and DRR) | not yet run | not yet run | not yet run | not yet run | not yet run |
| APP T p50 / p95 (µs) | not yet run | not yet run | not yet run | not yet run | not yet run |
| GPU U p50 / p95 (%) | not yet run | not yet run | not yet run | not yet run | not yet run |
| Stale frames (total, % of frames) | not yet run | not yet run | not yet run | not yet run | not yet run |
| Max consecutive stale | not yet run | not yet run | not yet run | not yet run | not yet run |
| FPS p50 / p5 | not yet run | not yet run | not yet run | not yet run | not yet run |
| Thermal (POW L max, battery °C start → end) | not yet run | not yet run | not yet run | not yet run | not yet run |
| EBW × EBH | not yet run | not yet run | not yet run | not yet run | not yet run |
| Foveation level (FOV) | not yet run | not yet run | not yet run | not yet run | not yet run |
| RSS p50 / max (MB) | not yet run | not yet run | not yet run | not yet run | not yet run |
| CSV rows used | not yet run | not yet run | not yet run | not yet run | not yet run |
| Run directory | not yet run | not yet run | not yet run | not yet run | not yet run |

### Quest 3S, highest available refresh rate

Candidate runs with `displayRefreshRate: "highest"` (device pass §5). Baseline is n/a: virocore `f5c2a728` cannot request a rate, and a setprop override voids the run.

| Metric | Baseline 1.0 / MEDIUM | Candidate 1.0 / LOW | Candidate 1.0 / MEDIUM | Candidate 1.3 / LOW | Candidate 1.3 / MEDIUM |
| --- | --- | --- | --- | --- | --- |
| Requested / chosen rate (`[XR-QUALITY]` line), result code | n/a | not yet run | not yet run | not yet run | not yet run |
| Rate after switch (`changed` line, DRR) | n/a | not yet run | not yet run | not yet run | not yet run |
| APP T p50 / p95 (µs) | n/a | not yet run | not yet run | not yet run | not yet run |
| GPU U p50 / p95 (%) | n/a | not yet run | not yet run | not yet run | not yet run |
| Stale frames (total, % of frames) | n/a | not yet run | not yet run | not yet run | not yet run |
| Max consecutive stale | n/a | not yet run | not yet run | not yet run | not yet run |
| FPS p50 / p5 | n/a | not yet run | not yet run | not yet run | not yet run |
| Thermal (POW L max, battery °C start → end) | n/a | not yet run | not yet run | not yet run | not yet run |
| EBW × EBH | n/a | not yet run | not yet run | not yet run | not yet run |
| Foveation level (FOV) | n/a | not yet run | not yet run | not yet run | not yet run |
| RSS p50 / max (MB) | n/a | not yet run | not yet run | not yet run | not yet run |
| CSV rows used | n/a | not yet run | not yet run | not yet run | not yet run |
| Run directory | n/a | not yet run | not yet run | not yet run | not yet run |

### PICO 4 Ultra, runtime default refresh rate

| Metric | Baseline 1.0 / MEDIUM | Candidate 1.0 / LOW | Candidate 1.0 / MEDIUM | Candidate 1.3 / LOW | Candidate 1.3 / MEDIUM |
| --- | --- | --- | --- | --- | --- |
| Refresh rate (Hz, from `[XR-DIAG]` and HUD DRR) | not yet run | not yet run | not yet run | not yet run | not yet run |
| APP T p50 / p95 (µs) | not yet run | not yet run | not yet run | not yet run | not yet run |
| GPU U (HUD spot readings) | not yet run | not yet run | not yet run | not yet run | not yet run |
| Stale frames | not yet run | not yet run | not yet run | not yet run | not yet run |
| FPS (HUD spot readings) | not yet run | not yet run | not yet run | not yet run | not yet run |
| Thermal (HUD CPU/GPU °C start → end, sampler status) | not yet run | not yet run | not yet run | not yet run | not yet run |
| EBW × EBH | not yet run | not yet run | not yet run | not yet run | not yet run |
| Foveation level (FRL) | not yet run | not yet run | not yet run | not yet run | not yet run |
| RSS p50 / max (MB, sampler) | not yet run | not yet run | not yet run | not yet run | not yet run |
| Run directory | not yet run | not yet run | not yet run | not yet run | not yet run |

### PICO 4 Ultra, highest available refresh rate

Candidate runs with `displayRefreshRate: "highest"` (device pass §5). Baseline is n/a: virocore `f5c2a728` cannot request a rate, and the Performance Tuner voids the run.

| Metric | Baseline 1.0 / MEDIUM | Candidate 1.0 / LOW | Candidate 1.0 / MEDIUM | Candidate 1.3 / LOW | Candidate 1.3 / MEDIUM |
| --- | --- | --- | --- | --- | --- |
| Requested / chosen rate (`[XR-QUALITY]` line), result code | n/a | not yet run | not yet run | not yet run | not yet run |
| Rate after switch (`changed` line, HUD DRR) | n/a | not yet run | not yet run | not yet run | not yet run |
| APP T p50 / p95 (µs) | n/a | not yet run | not yet run | not yet run | not yet run |
| GPU U (HUD spot readings) | n/a | not yet run | not yet run | not yet run | not yet run |
| Stale frames | n/a | not yet run | not yet run | not yet run | not yet run |
| FPS (HUD spot readings) | n/a | not yet run | not yet run | not yet run | not yet run |
| Thermal (HUD CPU/GPU °C start → end, sampler status) | n/a | not yet run | not yet run | not yet run | not yet run |
| EBW × EBH | n/a | not yet run | not yet run | not yet run | not yet run |
| Foveation level (FRL) | n/a | not yet run | not yet run | not yet run | not yet run |
| RSS p50 / max (MB, sampler) | n/a | not yet run | not yet run | not yet run | not yet run |
| Run directory | n/a | not yet run | not yet run | not yet run | not yet run |

## R1.5 memory results

Sampler columns `app_total_rss_kb` and `mem_available_kb`, plus OVR Metrics `app_rss_MB` and `available_memory_MB` on Quest. Each count is held for 2 minutes after the surfaces are visible; the value is the median of that window.

| Device | Surfaces | Baseline RSS (MB) | Candidate RSS (MB) | Baseline MemAvailable (MB) | Candidate MemAvailable (MB) | Run directories |
| --- | --- | --- | --- | --- | --- | --- |
| Quest 3S | 1 | not yet run | not yet run | not yet run | not yet run | not yet run |
| Quest 3S | 2 | not yet run | not yet run | not yet run | not yet run | not yet run |
| Quest 3S | 4 | not yet run | not yet run | not yet run | not yet run | not yet run |
| PICO 4 Ultra | 1 | not yet run | not yet run | not yet run | not yet run | not yet run |
| PICO 4 Ultra | 2 | not yet run | not yet run | not yet run | not yet run | not yet run |
| PICO 4 Ultra | 4 | not yet run | not yet run | not yet run | not yet run | not yet run |

## When a number needs explaining

Re-run that cell with `PERFETTO=1 scripts/device/capture-start.sh …` for 60 seconds, not 10 minutes, so tracing does not sit under the soak. Open the trace with `npx -y metavr perf load <file>` and `metavr perf context`, or in ui.perfetto.dev. The config is `scripts/device/perfetto-vr.pbtx`. Whether `gpu.renderstages` and `gpu.counters` produce data on either headset's firmware is not documented; the trace records it either way.
