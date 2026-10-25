#!/usr/bin/env bash
# Stop the capture started by capture-start.sh, pull every file and extract the
# log lines the matrix needs.
#
#   scripts/device/capture-stop.sh            # the latest run
#   RUN_DIR=<dir> scripts/device/capture-stop.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

RUN="$(current_run_dir)"
[[ -f "$RUN/run.env" ]] || die "$RUN has no run.env"
# run.env sets serial, start_epoch, omms and the *_pid / perfetto_* values.
# shellcheck disable=SC1091,SC2154
source "$RUN/run.env"
: "${start_epoch:?run.env has no start_epoch}"
perfetto_trace="${perfetto_trace:-}"
SERIAL="${SERIAL:-$serial}"
stop_epoch="$(date +%s)"

for pid_var in sampler_pid logcat_pid; do
  pid="${!pid_var:-}"
  [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
done

OMMS=com.oculus.ovrmonitormetricsservice
if [[ "${omms:-}" == on ]]; then
  adbs shell am broadcast -n "$OMMS/.SettingsBroadcastReceiver" -a "$OMMS.DISABLE_CSV" >/dev/null
  dir="/sdcard/Android/data/$OMMS/files/CapturedMetrics"
  mkdir -p "$RUN/ovr-metrics"
  # New files only: the tool writes one CSV per app run and keeps old ones.
  adbs shell ls "$dir/" 2>/dev/null | tr -d '\r' | sort >"$RUN/omms-after.txt" || true
  sort "$RUN/omms-before.txt" 2>/dev/null | comm -13 - "$RUN/omms-after.txt" | while read -r f; do
    if [[ -n "$f" ]]; then adbs pull "$dir/$f" "$RUN/ovr-metrics/" >/dev/null; fi
  done
  [[ -n "$(find "$RUN/ovr-metrics" -type f -name '*.csv' -print -quit)" ]] || note "no new OVR Metrics CSV; was the app (re)launched after capture-start?"
fi

if [[ -n "${perfetto_pid:-}" ]]; then
  adbs shell kill "$perfetto_pid" 2>/dev/null || true
  # Perfetto finalises the file after SIGTERM; wait for it to stop.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    adbs shell "kill -0 $perfetto_pid" >/dev/null 2>&1 || break
    sleep 1
  done
  adbs pull "$perfetto_trace" "$RUN/" >/dev/null
fi

record_device_info "$RUN/device-after.txt"
"$DEVICE_DIR/check-overrides.sh" "$RUN/overrides-after.txt" >/dev/null || true

# Extracts. Format strings and tags, cited to the source that prints them:
#   VRORendererOpenXR "Eye %u: recommended %ux%u, max %ux%u, rendering %ux%u"
#     virocore 70e95fd8+ VROSceneRendererOpenXR.cpp:1052 (b73d919); absent at
#     f5c2a728, which logs only "Eye %u: swapchain ..." at VERBOSE (line 1054).
#   VRORendererOpenXR "[XR-DIAG] display refresh rate ..." (b73d919 :1189-1199)
#   VRORendererOpenXR "[XR-PANEL] compositor maxLayers=..." (:538) and
#     "compositor panel %s: %s (%s)" presentation/eviction (:1819)
#   ViroRivePanel "EGL ready..." (VRORivePanelEGL.cpp:194), ViroOpenXRRivePanel
#     "finish pass ready..." (VROOpenXRRivePanelProducer.cpp:69)
#   ViroRivePanel "render mode scene=%p interlock=... GL_RENDERER=..." once per
#     Rive render context (virocore 8f0e920b VRORivePanelScene.cpp)
#   VRORendererOpenXR "OpenXR panel swapchains: live=%d ..." and
#     "OpenXR eye swapchains: live=%d ..." (8f0e920b); Viro
#     "ExternalSurfaceTexture: live=%d ..." and "AndroidViewTexture: live=%d ..."
#     (VROAndroidViewTexture.cpp). Events only, never per frame.
#   NativePanelsRive, WhiteboardRenderer, ViroSpatialPanels: viro-external
#     packages/native-panels and packages/spatial-panels
LOG="$RUN/logcat.txt"
grep -E 'Eye [0-9]+: (recommended|swapchain)' "$LOG" >"$RUN/eye-buffer.txt" || true
grep -E 'XR-DIAG\] display refresh rate' "$LOG" >"$RUN/refresh-rate.txt" || true
grep -E 'ViroRivePanel|ViroOpenXRRivePanel|NativePanelsRive' "$LOG" >"$RUN/rive.txt" || true
grep -E 'XR-PANEL|compositor panel|addRiveCompositorPanel|ViroSpatialPanels' "$LOG" >"$RUN/compositor.txt" || true
grep -E 'WhiteboardRenderer' "$LOG" >"$RUN/whiteboard.txt" || true
grep -E 'render mode scene=' "$LOG" >"$RUN/rive-mode.txt" || true
grep -E '(OpenXR (panel|eye) swapchains|ExternalSurfaceTexture|AndroidViewTexture): live=' "$LOG" >"$RUN/live-counts.txt" || true
grep -E 'FATAL EXCEPTION|SIGSEGV|SIGABRT|Abort message|ANR in|EGL_BAD|GL_INVALID|lowmemorykiller.*'"$APP_ID" "$LOG" >"$RUN/crashes.txt" || true

{
  echo "stop_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "duration_s=$(( stop_epoch - start_epoch ))"
  echo "eye_buffer_lines=$(wc -l <"$RUN/eye-buffer.txt" | tr -d ' ')"
  echo "rive_lines=$(wc -l <"$RUN/rive.txt" | tr -d ' ')"
  echo "compositor_lines=$(wc -l <"$RUN/compositor.txt" | tr -d ' ')"
  echo "crash_lines=$(wc -l <"$RUN/crashes.txt" | tr -d ' ')"
  echo "ovr_metrics_csv=$(find "$RUN" -path '*/ovr-metrics/*.csv' 2>/dev/null | wc -l | tr -d ' ')"
  echo "perfetto_trace=$(find "$RUN" -name '*.pftrace' 2>/dev/null | head -1)"
  echo "sampler_rows=$(( $(wc -l <"$RUN/sampler.tsv") - 1 ))"
} | tee "$RUN/summary.txt"
note "run directory: $RUN"
