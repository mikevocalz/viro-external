# shellcheck shell=bash
# Shared helpers for scripts/device/*.sh. Source it; do not run it.

set -euo pipefail

# shellcheck disable=SC2034  # used by the scripts that source this file
DEVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Every capture lands under one run directory so the matrix can link to it.
# Outside the repo by default: captures are large and are not committed.
RUNS_ROOT="${RUNS_ROOT:-$HOME/viro-device-runs}"
APP_ID="${APP_ID:-com.moyolearn.app}"

die() { printf 'error: %s\n' "$*" >&2; exit 3; }  # 3: setup error, never a result
note() { printf '%s\n' "$*" >&2; }

# Picks the one connected device, or $SERIAL when several are attached.
pick_serial() {
  if [[ -n "${SERIAL:-}" ]]; then
    adb -s "$SERIAL" get-state >/dev/null 2>&1 || die "SERIAL=$SERIAL is not connected"
    printf '%s' "$SERIAL"
    return
  fi
  local serials
  serials="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
  local count
  count="$(printf '%s' "$serials" | grep -c . || true)"
  [[ "$count" -eq 1 ]] || die "expected exactly one headset in 'adb devices', found $count; set SERIAL"
  printf '%s' "$serials"
}

adbs() { adb -s "$SERIAL" "$@"; }
prop() { adbs shell getprop "$1" | tr -d '\r'; }

# quest | pico, from the manufacturer property. Anything else stops the run.
detect_platform() {
  local maker
  maker="$(prop ro.product.manufacturer | tr '[:upper:]' '[:lower:]')"
  case "$maker" in
    oculus|meta*) printf 'quest' ;;
    pico*|bytedance*) printf 'pico' ;;
    *) die "unrecognised manufacturer '$maker'; this pass covers Quest 3S and PICO 4 Ultra only" ;;
  esac
}

# OS and runtime identity. Property sources:
#   Quest: ro.vros.build.version (Meta native SDK project setup page,
#          developers.meta.com/vr/documentation/native/metavr-os-nsdk/metavr-os-nsdk-project-setup/)
#   PICO:  no documented property for PICO 4 Ultra; ro.pvr.internal.version is
#          from the legacy PICO ADB guide (sdk.picovr.com/docs/ADBCommand/chapter_two.html)
#          and ro.build.display.id is the stock Android build string. All are
#          recorded; an empty value is written as "(empty)", never guessed.
record_device_info() {
  local out="$1"
  {
    echo "date_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "serial=$SERIAL"
    local p
    for p in ro.product.manufacturer ro.product.model ro.build.fingerprint \
             ro.build.version.incremental ro.build.version.release ro.build.version.sdk \
             ro.build.display.id ro.vros.build.version ro.pvr.internal.version; do
      local v
      v="$(prop "$p")"
      echo "$p=${v:-(empty)}"
    done
    # Runtime and system packages that carry the OpenXR runtime or the
    # compositor. Names differ per vendor, so record every match.
    local pkg
    for pkg in $(adbs shell pm list packages | tr -d '\r' | sed 's/^package://' \
                 | grep -i -E 'openxr|runtime|systemdriver|vrdriver|vrshell|ovrmonitormetricsservice|pxr|pvr' | sort); do
      echo "pkg:$pkg=$(adbs shell dumpsys package "$pkg" | tr -d '\r' | awk -F= '/versionName=/ { print $2; exit }')"
    done
    echo "app:$APP_ID=$(adbs shell dumpsys package "$APP_ID" | tr -d '\r' | awk -F= '/versionName=/ { print $2; exit }')"
    local apk
    apk="$(adbs shell pm path "$APP_ID" 2>/dev/null | tr -d '\r' | sed -n 's/^package://p' | head -1)"
    if [[ -n "$apk" ]]; then
      echo "app_apk_sha256_on_device=$(adbs shell sha256sum "$apk" | awk '{print $1}')"
    fi
  } >"$out"
}

# The newest run directory, or the one named by $RUN_DIR.
current_run_dir() {
  if [[ -n "${RUN_DIR:-}" ]]; then printf '%s' "$RUN_DIR"; return; fi
  [[ -f "$RUNS_ROOT/LATEST" ]] || die "no run started; run capture-start.sh first or set RUN_DIR"
  cat "$RUNS_ROOT/LATEST"
}
