#!/usr/bin/env bash
# Start log and metric capture for one matrix cell.
#
#   scripts/device/capture-start.sh <label>
#   e.g. capture-start.sh R1.4-quest-candidate-default-hz
#
# Starts, in one run directory under $RUNS_ROOT:
#   - device and runtime identity (device-before.txt)
#   - the override check (overrides.txt); a void result stops here unless
#     ALLOW_VOID=yes, and the run is then marked void in its directory name
#   - full logcat with -v threadtime (logcat.txt); capture-stop.sh extracts the
#     eye-buffer, refresh-rate, Rive and panel-compositor lines from it
#   - Quest: OVR Metrics Tool CSV recording via its documented broadcasts
#   - a host-side sampler every $SAMPLE_SECONDS s: app RSS/PSS, MemAvailable,
#     thermal status (sampler.tsv)
#   - Perfetto with perfetto-vr.pbtx when PERFETTO=1 (off by default so the
#     soak numbers are not taken under tracing load)
#
# PICO: the PICO Metrics HUD shows GPU U, CPU U, FPS, FRL, EBW/EBH, RSS and
# temperatures live but "does not support exporting raw performance data"
# (developer-cn.picoxr.com/document/unity/metrics-hud). Turn it on in
# Settings > Developer and record the headset view; the sampler and Perfetto
# are the exported numbers on PICO.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

LABEL="${1:-}"
[[ "$LABEL" =~ ^[A-Za-z0-9._-]+$ ]] || die "usage: $0 <label> (letters, digits, . _ -)"
SAMPLE_SECONDS="${SAMPLE_SECONDS:-10}"

SERIAL="$(pick_serial)"; export SERIAL
PLATFORM="$(detect_platform)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN="$RUNS_ROOT/$STAMP-$LABEL"
mkdir -p "$RUN"

record_device_info "$RUN/device-before.txt"
set +e
"$DEVICE_DIR/check-overrides.sh" "$RUN/overrides.txt" >/dev/null
ov=$?
set -e
if (( ov != 0 )); then
  cat "$RUN/overrides.txt" >&2
  if [[ "${ALLOW_VOID:-}" != yes ]]; then
    rm -r "$RUN"
    die "override check did not pass (exit $ov); fix it, or set ALLOW_VOID=yes to capture a run marked void"
  fi
  mv "$RUN" "$RUN-VOID"
  RUN="$RUN-VOID"
fi

{
  echo "label=$LABEL"
  echo "platform=$PLATFORM"
  echo "serial=$SERIAL"
  echo "start_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "start_epoch=$(date +%s)"
} >"$RUN/run.env"

# Logcat: clear first so the file starts with this run.
adbs logcat -c || true
adbs logcat -v threadtime >"$RUN/logcat.txt" 2>&1 &
echo "logcat_pid=$!" >>"$RUN/run.env"

# OVR Metrics Tool (Quest). Package, broadcast receiver, actions, stat ids and
# CSV directory from
# https://developers.meta.com/horizon/documentation/native/android/ts-ovrmetricstool
OMMS=com.oculus.ovrmonitormetricsservice
if [[ "$PLATFORM" == quest ]]; then
  if adbs shell pm path "$OMMS" >/dev/null 2>&1; then
    omms() { adbs shell am broadcast -n "$OMMS/.SettingsBroadcastReceiver" -a "$OMMS.$1" "${@:2}" >/dev/null; }
    for stat in app_gpu_time_microseconds gpu_utilization_percentage cpu_utilization_percentage \
                stale_frame_count stale_frames_consecutive average_frame_rate display_refresh_rate \
                eye_buffer_width eye_buffer_height foveation_level app_rss_MB app_pss_MB \
                available_memory_MB cpu_level gpu_level power_level_state battery_temperature_celcius \
                timewarp_gpu_time_microseconds; do
      omms ENABLE_STAT --es stat "$stat"
    done
    adbs shell ls "/sdcard/Android/data/$OMMS/files/CapturedMetrics/" 2>/dev/null | tr -d '\r' >"$RUN/omms-before.txt" || true
    omms ENABLE_CSV
    echo "omms=on" >>"$RUN/run.env"
  else
    note "OVR Metrics Tool ($OMMS) is not installed; install it from the Meta Horizon Store or MQDH. Continuing without CSV."
    echo "omms=missing" >>"$RUN/run.env"
  fi
else
  echo "omms=n/a" >>"$RUN/run.env"
  note "PICO: turn on Settings > Developer > Metrics HUD and record the headset view for this run."
fi

# Host-side sampler: memory and thermal every SAMPLE_SECONDS.
(
  set +e
  printf 'epoch\tapp_total_pss_kb\tapp_total_rss_kb\tmem_available_kb\tthermal_status\n'
  while :; do
    mi="$(adbs shell dumpsys meminfo "$APP_ID" 2>/dev/null | tr -d '\r')"
    pss="$(awk '/TOTAL PSS:/ { print $3; exit }' <<<"$mi")"
    rss="$(awk '/TOTAL RSS:/ { print $6; exit }' <<<"$mi")"
    avail="$(adbs shell cat /proc/meminfo 2>/dev/null | tr -d '\r' | awk '/MemAvailable:/ { print $2 }')"
    therm="$(adbs shell dumpsys thermalservice 2>/dev/null | tr -d '\r' | awk -F': ' '/Thermal Status:/ { print $2; exit }')"
    printf '%s\t%s\t%s\t%s\t%s\n' "$(date +%s)" "${pss:-}" "${rss:-}" "${avail:-}" "${therm:-}"
    sleep "$SAMPLE_SECONDS"
  done
) >"$RUN/sampler.tsv" 2>/dev/null &
echo "sampler_pid=$!" >>"$RUN/run.env"

# Perfetto (opt-in). Config through stdin works on every Android version the
# Perfetto docs cover (https://perfetto.dev/docs/concepts/config).
if [[ "${PERFETTO:-0}" == 1 ]]; then
  TRACE="/data/misc/perfetto-traces/$STAMP-$LABEL.pftrace"
  pid="$(adbs shell "perfetto --txt -c - -o $TRACE --background" <"$DEVICE_DIR/perfetto-vr.pbtx" | tr -d '\r' | tail -1)"
  [[ "$pid" =~ ^[0-9]+$ ]] || die "perfetto did not start: $pid"
  { echo "perfetto_pid=$pid"; echo "perfetto_trace=$TRACE"; } >>"$RUN/run.env"
fi

printf '%s\n' "$RUN" >"$RUNS_ROOT/LATEST"
note "capturing into $RUN"
note "run the workload now; stop with scripts/device/capture-stop.sh"
