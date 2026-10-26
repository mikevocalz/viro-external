#!/usr/bin/env bash
# Confirm nothing overrides resolution, foveation or refresh rate. A run with an
# override active is void (device-pass prompt §6.4 "No overrides").
#
#   scripts/device/check-overrides.sh [out-file]
#
# Exit 0: clean. Exit 1: an override is set (run is void).
# Exit 2: PICO, and the Performance Tuner state is not yet confirmed by hand.
# Exit 3: setup error (no headset, unknown device); nothing was checked.
#
# Quest sources (both read 2026-10-25):
#   https://developers.meta.com/horizon/documentation/spatial-sdk/ts-systemproperties/
#     debug.oculus.refreshRate, textureWidth, textureHeight, cpuLevel, gpuLevel,
#     foveation.dynamic. "Changes to system properties do not persist over reboots."
#   https://developers.meta.com/horizon/documentation/unity/ts-mqdh-media/
#     debug.oculus.foveation.level, gfr.mode, dynResScaler, forceSpaceWarp,
#     swapInterval, eyeFov*.
# PICO: the Performance Tuner (Settings > Developer, PICO 4 Ultra OS 5.13.0+)
#   sets refresh rate, eye-buffer resolution, CPU/GPU level and FFR per app. No
#   documented property exposes its state, so it is confirmed by hand:
#   PERF_TUNER_OFF=yes after Mike checks that no profile exists for the app.
#   The persist.pvr.config.* properties come from the legacy PICO ADB guide
#   (https://sdk.picovr.com/docs/ADBCommand/chapter_two.html, Neo 3 era) and
#   are checked as well; they are not confirmed on PICO 4 Ultra.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

SERIAL="$(pick_serial)"; export SERIAL
PLATFORM="$(detect_platform)"
OUT="${1:-}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

QUEST_PROPS=(
  debug.oculus.refreshRate debug.oculus.textureWidth debug.oculus.textureHeight
  debug.oculus.foveation.level debug.oculus.foveation.dynamic debug.oculus.foveation.subsampled
  debug.oculus.gfr.mode debug.oculus.dynResScaler debug.oculus.forceSpaceWarp
  debug.oculus.swapInterval debug.oculus.cpuLevel debug.oculus.gpuLevel
  debug.oculus.eyeFovUp debug.oculus.eyeFovDown debug.oculus.eyeFovInward debug.oculus.eyeFovOutward
)
PICO_PROPS=(
  persist.pvr.config.target_fps persist.pvr.config.eyebuffer_width persist.pvr.config.eyebuffer_height
)

status=0
{
  echo "platform=$PLATFORM serial=$SERIAL date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [[ "$PLATFORM" == quest ]]; then
    for p in "${QUEST_PROPS[@]}"; do
      v="$(prop "$p")"
      if [[ -n "$v" ]]; then echo "OVERRIDE $p=$v"; status=1; else echo "clean    $p"; fi
    done
  else
    for p in "${PICO_PROPS[@]}"; do
      v="$(prop "$p")"
      # -1 is the documented "no cap" value for target_fps.
      if [[ -n "$v" && "$v" != "-1" ]]; then echo "OVERRIDE $p=$v"; status=1; else echo "clean    $p${v:+=$v}"; fi
    done
    if [[ "${PERF_TUNER_OFF:-}" == yes ]]; then
      echo "confirmed Performance Tuner: no profile for $APP_ID (by hand)"
    else
      echo "UNCONFIRMED Performance Tuner: open Settings > Developer > Performance Tuner, confirm no profile for $APP_ID, rerun with PERF_TUNER_OFF=yes"
      (( status == 0 )) && status=2
    fi
  fi
  # Everything else that looks like a render override, for the record.
  echo "-- all render-related properties --"
  adbs shell getprop | tr -d '\r' | grep -i -E 'debug\.oculus|pvr\.config|pxr|foveat|refresh|eyebuffer|texture(width|height)' || echo "(none)"
  case $status in
    0) echo "RESULT clean" ;;
    1) echo "RESULT void: an override is active" ;;
    2) echo "RESULT pending: Performance Tuner not confirmed" ;;
  esac
} >"$TMP"
cat "$TMP"
[[ -z "$OUT" ]] || cp "$TMP" "$OUT"
exit "$status"
