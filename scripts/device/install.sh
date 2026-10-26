#!/usr/bin/env bash
# Install one APK on the connected headset and record what is now on it.
#
#   scripts/device/install.sh <apk> [--clean]
#
# --clean uninstalls first (wipes app data, including any sign-in). Without it
# the install is `adb install -r`, which keeps data; both stacks are signed with
# the same key, so Baseline and Candidate replace each other in place.
# Either way the script proves which binary is installed by comparing the
# on-device APK's sha256 with the local file.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "$0")/lib.sh"

APK="${1:-}"
[[ -f "$APK" ]] || die "usage: $0 <apk> [--clean]"
CLEAN="${2:-}"

SERIAL="$(pick_serial)"; export SERIAL
PLATFORM="$(detect_platform)"
case "$(basename "$APK")" in
  *quest*) [[ "$PLATFORM" == quest ]] || die "quest APK on a $PLATFORM headset" ;;
  *pico*) [[ "$PLATFORM" == pico ]] || die "pico APK on a $PLATFORM headset" ;;
  *) die "APK name must say quest or pico; never install a mobile flavor on a headset" ;;
esac

if [[ "$CLEAN" == --clean ]]; then
  adbs uninstall "$APP_ID" >/dev/null 2>&1 || true
fi
adbs install -r "$APK"

LOCAL_SHA="$(shasum -a 256 "$APK" | awk '{print $1}')"
INFO_DIR="$RUNS_ROOT/installs"
mkdir -p "$INFO_DIR"
INFO="$INFO_DIR/$(date -u +%Y%m%dT%H%M%SZ)-$PLATFORM.txt"
record_device_info "$INFO"
echo "local_apk=$APK" >>"$INFO"
echo "local_apk_sha256=$LOCAL_SHA" >>"$INFO"
# build-stack.sh records every APK in out/manifest.json, keyed by file name.
MANIFEST="$(dirname "$APK")/manifest.json"
if [[ -f "$MANIFEST" ]]; then
  node -e '
    const e = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
      .find((x) => x.apk === process.argv[2]);
    if (e) process.stdout.write("build:" + JSON.stringify(e) + "\n");
  ' "$MANIFEST" "$(basename "$APK")" >>"$INFO" || true
fi

DEVICE_SHA="$(awk -F= '/^app_apk_sha256_on_device=/ { print $2 }' "$INFO")"
[[ "$DEVICE_SHA" == "$LOCAL_SHA" ]] || die "installed APK sha256 $DEVICE_SHA != $LOCAL_SHA"
cat "$INFO"
note "installed and verified; record written to $INFO"
