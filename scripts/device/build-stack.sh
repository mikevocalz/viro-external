#!/usr/bin/env bash
# Build one MoyoLearn release APK on one native stack, for the 2026-10 device pass.
#
#   scripts/device/build-stack.sh <baseline|candidate> <quest|pico>
#
# Every input is a fresh clone at a recorded SHA under $WORK_DIR, so nothing in
# your own checkouts of virocore, viro, viro-external or MoyoLearn is touched.
# Both stacks get the same app commit and the same steps; only the native stack
# differs. The script prints every SHA and the sha256 of the libviro_renderer.so
# that ends up inside the APK, and stops if that .so is not the one it built.
#
# Environment (all optional):
#   WORK_DIR            scratch root (default: $HOME/viro-device-builds)
#   APP_REPO            MoyoLearn clone to clone from (default: $HOME/moyolearn-spm)
#   APP_SHA             consumer-app commit (default: a6afe6593060b73c8fc7b61d2ee0e0800204f1f3)
#   VIROCORE_REPO / VIRO_REPO / VIRO_EXTERNAL_REPO   local clones to clone from
#   VIROCORE_SHA / VIRO_SHA / VIRO_EXTERNAL_SHA      override the stack's SHAs
#   MIN_FREE_GB         refuse to start below this much free disk (default: 25)
#
# Stack SHAs. Baseline is fixed by the device-pass prompt (§1). Candidate is
# the PR stack heads recorded 2026-10-25 with `gh pr view`; when a PR moves,
# pass the new head through the *_SHA variables and record it in the matrix.
set -euo pipefail

STACK="${1:-}"
PLATFORM="${2:-}"
[[ "$STACK" == baseline || "$STACK" == candidate ]] || { echo "usage: $0 <baseline|candidate> <quest|pico>" >&2; exit 2; }
[[ "$PLATFORM" == quest || "$PLATFORM" == pico ]] || { echo "usage: $0 <baseline|candidate> <quest|pico>" >&2; exit 2; }

if [[ "$STACK" == baseline ]]; then
  : "${VIROCORE_SHA:=f5c2a7289c1665ec83740339ddc4464680d31d6b}"      # virocore main before #112
  : "${VIRO_SHA:=99b1d87c55ca9f43a6452144183a0b32a2bfb3c9}"          # mikevocalz/viro main
  : "${VIRO_EXTERNAL_SHA:=bbd4c617c4e98c2edfe2e55aed65bab867fa18c5}" # viro-external main
else
  : "${VIROCORE_SHA:=b73d91962dbe97c9ccd31f4d18df932fd1c2e296}"      # virocore #113 head (built on #112 70e95fd8)
  : "${VIRO_SHA:=fa238896674c743db1719e4ad03882725ca4a29b}"          # viro #70 head (on #69 fe417ad8)
  : "${VIRO_EXTERNAL_SHA:=30a2848cd44c394e8ebb6168028e32235080df8b}" # viro-external #73 head (on #72 7e962577)
fi
: "${APP_SHA:=a6afe6593060b73c8fc7b61d2ee0e0800204f1f3}"
: "${WORK_DIR:=$HOME/viro-device-builds}"
: "${APP_REPO:=$HOME/moyolearn-spm}"
: "${VIROCORE_REPO:=$HOME/virocore}"
: "${VIRO_REPO:=$HOME/viro}"
: "${VIRO_EXTERNAL_REPO:=$HOME/viro-external}"
: "${MIN_FREE_GB:=25}"
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
export ANDROID_HOME

FLAVOR_CAP="$(tr '[:lower:]' '[:upper:]' <<<"${PLATFORM:0:1}")${PLATFORM:1}"
OUT="$WORK_DIR/$STACK"
LOG_DIR="$OUT/logs"
MANIFEST="$OUT/build-$PLATFORM.txt"

die() { printf 'build-stack: %s\n' "$*" >&2; exit 1; }
step() { printf '\n== %s\n' "$*" >&2; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

# 0. Preflight: disk, tools. A release build of this app plus a virocore build
# needs several GiB; a full disk fails half-way and leaves partial outputs.
free_gb="$(df -g "$HOME" | awk 'NR == 2 { print $4 }')"
(( free_gb >= MIN_FREE_GB )) || die "only ${free_gb} GiB free under $HOME; need ${MIN_FREE_GB}. Free space first."
for tool in git node pnpm java unzip shasum; do command -v "$tool" >/dev/null || die "missing tool: $tool"; done
NDK_READELF="$(find "$ANDROID_HOME/ndk" -path '*/toolchains/llvm/prebuilt/*/bin/llvm-readelf' 2>/dev/null | sort | tail -1)"
[[ -n "$NDK_READELF" ]] || die "no llvm-readelf under \$ANDROID_HOME/ndk; install an NDK"
mkdir -p "$OUT" "$LOG_DIR"

# Fresh clone at one SHA. Cloning from the local repo first keeps it fast; the
# SHA must exist there (fetch the PR branch into that repo if it does not).
clone_at() {
  local src="$1" dest="$2" sha="$3"
  if [[ ! -d "$dest/.git" ]]; then
    git clone --quiet --no-checkout "$src" "$dest"
  fi
  git -C "$dest" fetch --quiet origin "$sha" 2>/dev/null || true
  git -C "$dest" cat-file -e "$sha^{commit}" 2>/dev/null || die "$sha not found in $src; run 'git -C $src fetch --all' first"
  git -C "$dest" checkout --quiet --force --detach "$sha"
  git -C "$dest" clean -fdxq
  [[ -z "$(git -C "$dest" status --porcelain)" ]] || die "$dest is not clean at $sha"
}

step "Sources ($STACK)"
clone_at "$VIROCORE_REPO" "$OUT/virocore" "$VIROCORE_SHA"
clone_at "$VIRO_REPO" "$OUT/viro" "$VIRO_SHA"
clone_at "$VIRO_EXTERNAL_REPO" "$OUT/viro-external" "$VIRO_EXTERNAL_SHA"
clone_at "$APP_REPO" "$OUT/app-$PLATFORM" "$APP_SHA"

# 1. Renderer AAR from virocore, clean tree only. The candidate links the
# vendored rive-runtime, which has its own build step (virocore
# docs/RIVE_RUNTIME.md "Build recipe"); the baseline predates it.
step "virocore :viroreact:assembleRelease at $VIROCORE_SHA"
if [[ -x "$OUT/virocore/scripts/build-rive-runtime.sh" ]]; then
  (cd "$OUT/virocore" && scripts/build-rive-runtime.sh) >"$LOG_DIR/rive-runtime.log" 2>&1 \
    || die "rive-runtime build failed; see $LOG_DIR/rive-runtime.log"
fi
set +e
(cd "$OUT/virocore/android" && ./gradlew :viroreact:assembleRelease --no-daemon) >"$LOG_DIR/virocore.log" 2>&1
rc=$?
set -e
echo "virocore gradle exit=$rc" >&2
(( rc == 0 )) || die "virocore build failed; see $LOG_DIR/virocore.log"
RENDERER_AAR="$OUT/virocore/android/viroreact/build/outputs/aar/viroreact-release.aar"
[[ -f "$RENDERER_AAR" ]] || die "no $RENDERER_AAR"
unzip -p "$RENDERER_AAR" jni/arm64-v8a/libviro_renderer.so >"$OUT/renderer-aar.so"
AAR_SO_SHA="$(sha256 "$OUT/renderer-aar.so")"
AAR_SO_BUILDID="$("$NDK_READELF" -n "$OUT/renderer-aar.so" | awk '/Build ID/ { print $3 }')"

# 2. @reactvision/react-viro from the viro clone. Its committed bridge AAR
# (android/react_viro/react_viro-release.aar) is what that SHA ships.
step "viro pack at $VIRO_SHA"
(cd "$OUT/viro" && npm install --no-audit --no-fund --ignore-scripts && npm run build && npm pack --pack-destination "$OUT") \
  >"$LOG_DIR/viro.log" 2>&1 || die "viro build/pack failed; see $LOG_DIR/viro.log"
VIRO_TGZ="$(find "$OUT" -maxdepth 1 -name 'reactvision-react-viro-*.tgz' -newer "$OUT/viro/package.json" | head -1)"
[[ -n "$VIRO_TGZ" ]] || die "npm pack produced no tarball; see $LOG_DIR/viro.log"

# 3. The four @viro-external packages MoyoLearn consumes as vendored tarballs.
step "viro-external pack at $VIRO_EXTERNAL_SHA"
VX_PACKS="$OUT/vx-packs"
mkdir -p "$VX_PACKS"
(cd "$OUT/viro-external" && pnpm install --frozen-lockfile --ignore-scripts) >"$LOG_DIR/viro-external.log" 2>&1 \
  || die "viro-external install failed; see $LOG_DIR/viro-external.log"
for dir in viro-external-core media ui xr-platform-contract; do
  (cd "$OUT/viro-external/packages/$dir" && pnpm pack --pack-destination "$VX_PACKS") >>"$LOG_DIR/viro-external.log" 2>&1 \
    || die "pnpm pack $dir failed; see $LOG_DIR/viro-external.log"
done

# 4. App: install exactly as committed, then overlay the stack. The lockfile,
# the pnpm patch and package.json stay as committed, so the JS dependency
# graph is the app commit's; the overlay replaces only these package bodies.
APP="$OUT/app-$PLATFORM"
step "MoyoLearn install at $APP_SHA"
(cd "$APP" && pnpm install --frozen-lockfile) >"$LOG_DIR/app-install.log" 2>&1 \
  || die "app install failed; see $LOG_DIR/app-install.log"

overlay() {  # overlay <tgz> <node_modules package dir>
  local tgz="$1" dest="$2" tmp
  [[ -d "$dest" ]] || die "missing $dest after install"
  tmp="$(mktemp -d "$OUT/overlay.XXXXXX")"
  tar -xzf "$tgz" -C "$tmp"
  cp -R "$tmp/package/." "$dest/"
  rm -r "$tmp"
}

RV="$APP/node_modules/@reactvision/react-viro"
# The app's pnpm patch rewrites viro_renderer/build.gradle line 20 so Gradle
# takes the renderer from ext.moyoViroRendererAar. Keep that line through the
# overlay, then point the property at this stack's renderer.
cp "$RV/android/viro_renderer/build.gradle" "$OUT/viro_renderer.build.gradle.patched"
overlay "$VIRO_TGZ" "$RV"
cp "$OUT/viro_renderer.build.gradle.patched" "$RV/android/viro_renderer/build.gradle"
grep -q "moyoViroRendererAar" "$RV/android/viro_renderer/build.gradle" || die "renderer property hook lost in overlay"

overlay "$VX_PACKS"/viro-external-core-*.tgz "$APP/node_modules/@viro-external/core"
overlay "$VX_PACKS"/viro-external-media-*.tgz "$APP/node_modules/@viro-external/media"
overlay "$VX_PACKS"/viro-external-ui-*.tgz "$APP/node_modules/@viro-external/ui"
overlay "$VX_PACKS"/viro-external-xr-contract-*.tgz "$APP/node_modules/@viro-external/xr-contract"

# apps/mobile/android/build.gradle pins vendors/viro-renderer-034d3b9.aar and
# fails on any other SHA-256. Swap the file and its digest; nothing else in
# the Gradle files changes. The diff is saved next to the APK.
PINNED="$APP/vendors/viro-renderer-034d3b9.aar"
OLD_DIGEST="$(sha256 "$PINNED")"
cp "$RENDERER_AAR" "$PINNED"
NEW_DIGEST="$(sha256 "$PINNED")"
sed -i '' "s/$OLD_DIGEST/$NEW_DIGEST/" "$APP/apps/mobile/android/build.gradle"
grep -q "$NEW_DIGEST" "$APP/apps/mobile/android/build.gradle" || die "renderer digest pin not updated"
git -C "$APP" diff -- apps/mobile/android/build.gradle >"$OUT/app-$PLATFORM-gradle.diff"

# 5. Release build. The app signs release with its committed debug keystore
# (apps/mobile/android/app/build.gradle signingConfigs), so both stacks share
# one signature and no secret is involved.
step "assemble${FLAVOR_CAP}Release"
set +e
(cd "$APP/apps/mobile/android" && ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a \
  ./gradlew ":app:assemble${FLAVOR_CAP}Release" --no-daemon) >"$LOG_DIR/app-$PLATFORM.log" 2>&1
rc=$?
set -e
echo "app gradle exit=$rc" >&2
(( rc == 0 )) || die "app build failed; see $LOG_DIR/app-$PLATFORM.log"
APK="$APP/apps/mobile/android/app/build/outputs/apk/$PLATFORM/release/app-$PLATFORM-release.apk"
[[ -f "$APK" ]] || die "no APK at $APK; check the path Gradle printed in $LOG_DIR/app-$PLATFORM.log"
FINAL="$OUT/moyolearn-$STACK-$PLATFORM-release.apk"
cp "$APK" "$FINAL"

# 6. Prove the APK carries this stack's renderer. AGP may strip the .so again,
# so the bytes can differ; the GNU build ID survives stripping and must match.
unzip -p "$FINAL" lib/arm64-v8a/libviro_renderer.so >"$OUT/apk-$PLATFORM.so"
APK_SO_SHA="$(sha256 "$OUT/apk-$PLATFORM.so")"
APK_SO_BUILDID="$("$NDK_READELF" -n "$OUT/apk-$PLATFORM.so" | awk '/Build ID/ { print $3 }')"
[[ -n "$AAR_SO_BUILDID" && "$APK_SO_BUILDID" == "$AAR_SO_BUILDID" ]] \
  || die "APK libviro_renderer.so build ID $APK_SO_BUILDID != built renderer $AAR_SO_BUILDID (stale .so)"
# Second, independent check: #112 added the eye-buffer log line, so its format
# string is present in the candidate and absent in the baseline.
if strings "$OUT/apk-$PLATFORM.so" | grep -q "Eye %u: recommended"; then EYE_LINE=present; else EYE_LINE=absent; fi
if [[ "$STACK" == candidate && "$EYE_LINE" != present ]] || [[ "$STACK" == baseline && "$EYE_LINE" != absent ]]; then
  die "eye-buffer log string is $EYE_LINE in a $STACK APK; wrong renderer"
fi

{
  echo "stack=$STACK platform=$PLATFORM variant=${PLATFORM}Release date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "app (MoyoLearn)=$APP_SHA"
  echo "virocore=$VIROCORE_SHA"
  echo "viro=$VIRO_SHA ($(basename "$VIRO_TGZ"))"
  echo "viro-external=$VIRO_EXTERNAL_SHA"
  echo "rive-runtime=$(cat "$OUT/virocore/android/rive/RIVE_RUNTIME_COMMIT" 2>/dev/null || echo n/a)"
  echo "renderer AAR sha256=$(sha256 "$RENDERER_AAR")"
  echo "AAR arm64 libviro_renderer.so sha256=$AAR_SO_SHA build-id=$AAR_SO_BUILDID"
  echo "APK arm64 libviro_renderer.so sha256=$APK_SO_SHA build-id=$APK_SO_BUILDID"
  echo "eye-buffer log string=$EYE_LINE"
  echo "react_viro bridge AAR sha256=$(sha256 "$RV/android/react_viro/react_viro-release.aar")"
  echo "APK=$FINAL sha256=$(sha256 "$FINAL")"
  echo "signing=app debug keystore (apps/mobile/android/app/build.gradle)"
} | tee "$MANIFEST"
