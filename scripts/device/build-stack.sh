#!/usr/bin/env bash
# Build one MoyoLearn release APK on one native stack, for the 2026-10 device pass.
#
#   scripts/device/build-stack.sh <baseline|candidate> <quest|pico>
#
# Every input is a clone at a recorded SHA under $WORK_DIR/<stack>/, so nothing
# in your own checkouts of virocore, viro, viro-external or MoyoLearn is touched.
# Both stacks get the same app commit and the same steps; only the native stack
# (and, for Candidate R1.4 cells, the render-quality meta-data) differs.
#
# Output: $WORK_DIR/out/<stack>-<flavor>-s<scale>-<fov>[-hi].apk plus one entry
# in $WORK_DIR/out/manifest.json (SHAs, env, .so sha256 + GNU build ID, APK
# sha256). Build logs go to $WORK_DIR/out/logs/. When the APK is verified the
# script deletes $WORK_DIR/<stack>/ (every clone and build dir) unless
# KEEP_SOURCES=1, so only out/ stays on disk. Build several cells of one stack
# with KEEP_SOURCES=1 and drop it on the last one; the clones and their build
# outputs are reused while they exist.
#
# Render-quality cell (Candidate only; Baseline's renderer has no such keys):
#   SCALE=1.0|1.3...   writes com.viro.openxr.eyeBufferScale
#   FOVEATION=low|medium|high|off   writes foveationLevel + foveationDynamic=true
#   REFRESH=highest|<Hz>             writes com.viro.openxr.displayRefreshRate
# With none set, the manifest carries no com.viro.openxr.* key and the
# renderer's defaults apply (Candidate: 1.3, LOW dynamic, no refresh request,
# OpenXRRenderQuality.java at virocore 79f9fd89). These are the same keys the
# viro config plugin writes from android.openxr (viro plugins/util/
# openxrRenderQuality.ts at 98babbc1); MoyoLearn commits android/ and has no
# prebuild step, so the script writes them into the flavor manifest directly
# and then checks the merged manifest inside the APK.
#
# Environment (all optional):
#   WORK_DIR            scratch root (default: $HOME/viro-device-builds)
#   APP_REPO            MoyoLearn clone to clone from (default: $HOME/MoyoLearn)
#   APP_SHA             consumer-app commit (default: 0e9a1693, PR #125 commit A
#                       9411dc81 plus the one-tile fix, branch
#                       chore/device-validation-one-tile)
#   VIROCORE_REPO / VIRO_REPO / VIRO_EXTERNAL_REPO   local clones to clone from
#   VIROCORE_SHA / VIRO_SHA / VIRO_EXTERNAL_SHA      override the stack's SHAs
#   APP_ENV_FILE        the app's untracked env file, copied into the app clone
#                       (default: $APP_REPO/apps/mobile/.env). A release bundle
#                       without its app URL throws at startup, so the build
#                       fails if the exported bundle does not contain it.
#   MIN_FREE_GB         refuse to start below this much free disk (default: 30)
#   KEEP_SOURCES=1      keep $WORK_DIR/<stack>/ after a verified build
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
  : "${VIROCORE_SHA:=79f9fd89a0540281d473a57efd1590fb5642febd}"      # virocore #113 feat/compositor-panel-jni
  : "${VIRO_SHA:=98babbc1dc8b4e1357a6ab9283691025b2a3413c}"          # viro #70 feat/canvas-surfaces-registry
  : "${VIRO_EXTERNAL_SHA:=4dc2775d3a07a3f9267b9e8db201fe3edda51287}" # viro-external #73
fi
: "${APP_SHA:=0e9a1693b19909bd14568791172dc51a6ce0a4a4}"
: "${WORK_DIR:=$HOME/viro-device-builds}"
: "${APP_REPO:=$HOME/MoyoLearn}"
: "${VIROCORE_REPO:=$HOME/virocore}"
: "${VIRO_REPO:=$HOME/viro}"
: "${VIRO_EXTERNAL_REPO:=$HOME/viro-external}"
: "${APP_ENV_FILE:=$APP_REPO/apps/mobile/.env}"
: "${MIN_FREE_GB:=30}"
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
: "${SCALE:=}" "${FOVEATION:=}" "${REFRESH:=}" "${KEEP_SOURCES:=}"
export ANDROID_HOME

# MoyoLearn pins Node 24 (.nvmrc); Expo's config loader breaks on Node 26.
[[ -x /opt/homebrew/opt/node@24/bin/node ]] && export PATH="/opt/homebrew/opt/node@24/bin:$PATH"

die() { printf 'build-stack: %s\n' "$*" >&2; exit 1; }
step() { printf '\n== %s (%s)\n' "$*" "$(date -u +%H:%M:%SZ)" >&2; }
sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

# Cell: render-quality meta-data and the APK name.
if [[ "$STACK" == baseline ]]; then
  [[ -z "$SCALE$FOVEATION$REFRESH" ]] || die "Baseline (virocore $VIROCORE_SHA) reads no render-quality keys; unset SCALE/FOVEATION/REFRESH"
  CELL="s1.0-MEDIUM"   # f5c2a728: recommended size, MEDIUM dynamic foveation
else
  [[ -z "$FOVEATION" || "$FOVEATION" =~ ^(off|low|medium|high)$ ]] || die "FOVEATION must be off|low|medium|high"
  [[ -z "$REFRESH" || "$REFRESH" == highest || "$REFRESH" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "REFRESH must be highest or a number of Hz"
  [[ -z "$SCALE" || "$SCALE" =~ ^[0-9]+(\.[0-9]+)?$ ]] || die "SCALE must be a number"
  fov_label="$(tr '[:lower:]' '[:upper:]' <<<"${FOVEATION:-low}")"
  CELL="s${SCALE:-1.3}-${fov_label}"
  case "$REFRESH" in "") ;; highest) CELL="$CELL-hi" ;; *) CELL="$CELL-${REFRESH}hz" ;; esac
fi
NAME="$STACK-$PLATFORM-$CELL"

FLAVOR_CAP="$(tr '[:lower:]' '[:upper:]' <<<"${PLATFORM:0:1}")${PLATFORM:1}"
OUT="$WORK_DIR/$STACK"
DIST="$WORK_DIR/out"
LOG_DIR="$DIST/logs/$NAME"
FINAL="$DIST/$NAME.apk"

# 0. Preflight: disk, tools.
free_gb="$(df -g /System/Volumes/Data 2>/dev/null | awk 'NR == 2 { print $4 }')"
[[ -n "$free_gb" ]] || free_gb="$(df -g "$HOME" | awk 'NR == 2 { print $4 }')"
(( free_gb >= MIN_FREE_GB )) || die "only ${free_gb} GiB free; need ${MIN_FREE_GB}. Free space first."
for tool in git node pnpm npm java unzip shasum strings; do command -v "$tool" >/dev/null || die "missing tool: $tool"; done
NDK_READELF="$(find "$ANDROID_HOME/ndk" -path '*/toolchains/llvm/prebuilt/*/bin/llvm-readelf' 2>/dev/null | sort | tail -1)"
[[ -n "$NDK_READELF" ]] || die "no llvm-readelf under \$ANDROID_HOME/ndk; install an NDK"
AAPT2="$(find "$ANDROID_HOME/build-tools" -maxdepth 2 -name aapt2 2>/dev/null | sort -V | tail -1)"
[[ -n "$AAPT2" ]] || die "no aapt2 under \$ANDROID_HOME/build-tools"
mkdir -p "$OUT" "$LOG_DIR" "$DIST"
rm -f "$FINAL"

# The app reads its API origin from an untracked env file that Expo inlines
# into the release bundle. Read the origin here so step 6 can look for it in
# the APK. Neither the file nor the value is ever echoed.
[[ -f "$APP_ENV_FILE" ]] || die "no app env file at $APP_ENV_FILE; a bundle without the app URL crashes at launch"
APP_ORIGIN="$(awk -F= '/^[A-Z_]*APP_URL=/ { sub(/^[^=]*=/, ""); gsub(/^["'\'']|["'\'']$/, ""); sub(/\/+$/, ""); print; exit }' "$APP_ENV_FILE")"
[[ "$APP_ORIGIN" =~ ^https?://[^[:space:]]+$ ]] || die "$APP_ENV_FILE has no usable app URL line"
build_id() { "$NDK_READELF" -n "$1" | awk '/Build ID/ { print $3 }'; }

# Run the pnpm a repo pins in package.json "packageManager", fetched by npx.
# The global pnpm's own version switch depends on ~/Library/pnpm/.tools, which
# can be left half-deleted (2026-10-25: 12.8.1's bin links pointed at a missing
# node_modules), so the switch is turned off and the pinned version named.
pnpm_for() {  # pnpm_for <repo dir> <pnpm args...>
  local dir="$1"; shift
  local pm
  pm="$(node -p 'require(process.argv[1]).packageManager || ""' "$dir/package.json")"
  [[ "$pm" =~ ^pnpm@([0-9]+\.[0-9]+\.[0-9]+) ]] || die "$dir/package.json packageManager is '$pm', expected pnpm@x.y.z"
  (cd "$dir" && npm_config_manage_package_manager_versions=false npx --yes "pnpm@${BASH_REMATCH[1]}" "$@")
}

# Clone at one SHA. A clone already at that SHA keeps its ignored files
# (node_modules, build dirs) so later cells of the same stack build
# incrementally; tracked files are always reset and untracked ones removed.
# A clone moved to a new SHA is wiped completely (git clean -x).
clone_at() {
  local src="$1" dest="$2" sha="$3"
  if [[ ! -d "$dest/.git" ]]; then
    git clone --quiet --no-checkout "$src" "$dest"
  fi
  git -C "$dest" fetch --quiet origin "$sha" 2>/dev/null || true
  git -C "$dest" cat-file -e "$sha^{commit}" 2>/dev/null || die "$sha not found in $src; run 'git -C $src fetch --all' first"
  if [[ "$(git -C "$dest" rev-parse HEAD 2>/dev/null || true)" == "$sha" ]]; then
    git -C "$dest" checkout --quiet --force --detach "$sha"
    git -C "$dest" clean -fdq
  else
    git -C "$dest" checkout --quiet --force --detach "$sha"
    git -C "$dest" clean -fdxq
    rm -f "$dest.stamp"
  fi
  [[ -z "$(git -C "$dest" status --porcelain)" ]] || die "$dest is not clean at $sha"
}
stamp_ok() { [[ -f "$1.stamp" && "$(cat "$1.stamp")" == "$2" ]]; }

step "Sources ($STACK, $NAME)"
clone_at "$VIROCORE_REPO" "$OUT/virocore" "$VIROCORE_SHA"
clone_at "$VIRO_REPO" "$OUT/viro" "$VIRO_SHA"
clone_at "$VIRO_EXTERNAL_REPO" "$OUT/viro-external" "$VIRO_EXTERNAL_SHA"
clone_at "$APP_REPO" "$OUT/app-$PLATFORM" "$APP_SHA"
# Ignored by git, so the clone never has it; Expo loads it at bundle time.
cp "$APP_ENV_FILE" "$OUT/app-$PLATFORM/apps/mobile/.env"

# 1. Renderer AAR from virocore, clean tree only. The candidate links the
# vendored rive-runtime, which has its own build step (virocore
# docs/RIVE_RUNTIME.md "Build recipe"); the baseline predates it.
RENDERER_AAR="$OUT/virocore/android/viroreact/build/outputs/aar/viroreact-release.aar"
if stamp_ok "$OUT/virocore" "$VIROCORE_SHA" && [[ -f "$RENDERER_AAR" ]]; then
  step "virocore renderer AAR at $VIROCORE_SHA: reusing this stack's build"
else
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
  [[ -f "$RENDERER_AAR" ]] || die "no $RENDERER_AAR"
  echo "$VIROCORE_SHA" >"$OUT/virocore.stamp"
fi
unzip -p "$RENDERER_AAR" jni/arm64-v8a/libviro_renderer.so >"$OUT/renderer-aar.so"
AAR_SO_SHA="$(sha256 "$OUT/renderer-aar.so")"
AAR_SO_BUILDID="$(build_id "$OUT/renderer-aar.so")"

# 2. @reactvision/react-viro from the viro clone. Its committed bridge AAR
# (android/react_viro/react_viro-release.aar) is what that SHA ships.
VIRO_PACKS="$OUT/viro-packs"
if stamp_ok "$OUT/viro" "$VIRO_SHA" && compgen -G "$VIRO_PACKS/reactvision-react-viro-*.tgz" >/dev/null; then
  step "viro pack at $VIRO_SHA: reusing"
else
  step "viro pack at $VIRO_SHA"
  rm -rf "$VIRO_PACKS"; mkdir -p "$VIRO_PACKS"
  (cd "$OUT/viro" && npm install --no-audit --no-fund --ignore-scripts && npm run build && npm pack --pack-destination "$VIRO_PACKS") \
    >"$LOG_DIR/viro.log" 2>&1 || die "viro build/pack failed; see $LOG_DIR/viro.log"
  echo "$VIRO_SHA" >"$OUT/viro.stamp"
fi
VIRO_TGZ="$(find "$VIRO_PACKS" -maxdepth 1 -name 'reactvision-react-viro-*.tgz' | head -1)"
[[ -n "$VIRO_TGZ" ]] || die "npm pack produced no tarball; see $LOG_DIR/viro.log"

# 3. The four @viro-external packages MoyoLearn consumes as vendored tarballs.
VX_PACKS="$OUT/vx-packs"
if stamp_ok "$OUT/viro-external" "$VIRO_EXTERNAL_SHA" && [[ "$(find "$VX_PACKS" -name '*.tgz' 2>/dev/null | wc -l)" -eq 4 ]]; then
  step "viro-external pack at $VIRO_EXTERNAL_SHA: reusing"
else
  step "viro-external pack at $VIRO_EXTERNAL_SHA"
  rm -rf "$VX_PACKS"; mkdir -p "$VX_PACKS"
  pnpm_for "$OUT/viro-external" install --frozen-lockfile --ignore-scripts >"$LOG_DIR/viro-external.log" 2>&1 \
    || die "viro-external install failed; see $LOG_DIR/viro-external.log"
  for dir in viro-external-core media ui xr-platform-contract; do
    (cd "$OUT/viro-external/packages/$dir" && npm_config_manage_package_manager_versions=false \
      npx --yes "pnpm@$(node -p 'require(process.argv[1]).packageManager.split("@")[1]' "$OUT/viro-external/package.json")" \
      pack --pack-destination "$VX_PACKS") >>"$LOG_DIR/viro-external.log" 2>&1 \
      || die "pnpm pack $dir failed; see $LOG_DIR/viro-external.log"
  done
  echo "$VIRO_EXTERNAL_SHA" >"$OUT/viro-external.stamp"
fi

# 4. App: install exactly as committed, then overlay the stack. The lockfile,
# the pnpm patch and package.json stay as committed, so the JS dependency
# graph is the app commit's; the overlay replaces only these package bodies.
APP="$OUT/app-$PLATFORM"
RV="$APP/node_modules/@reactvision/react-viro"
APP_STAMP="$APP_SHA $(sha256 "$VIRO_TGZ") $(cat "$VX_PACKS"/*.tgz | shasum -a 256 | awk '{print $1}')"
if stamp_ok "$APP" "$APP_STAMP" && [[ -d "$RV" ]]; then
  step "MoyoLearn install + overlay at $APP_SHA: reusing"
else
  step "MoyoLearn install at $APP_SHA"
  pnpm_for "$APP" install --frozen-lockfile >"$LOG_DIR/app-install.log" 2>&1 \
    || die "app install failed; see $LOG_DIR/app-install.log"

  overlay() {  # overlay <tgz> <node_modules package dir>
    local tgz="$1" dest="$2" tmp
    [[ -d "$dest" ]] || die "missing $dest after install"
    tmp="$(mktemp -d "$OUT/overlay.XXXXXX")"
    tar -xzf "$tgz" -C "$tmp"
    cp -R "$tmp/package/." "$dest/"
    rm -r "$tmp"
  }

  # The app's pnpm patch rewrites viro_renderer/build.gradle line 20 so Gradle
  # takes the renderer from ext.moyoViroRendererAar. Keep that line through the
  # overlay, then point the property at this stack's renderer.
  cp "$RV/android/viro_renderer/build.gradle" "$OUT/viro_renderer.build.gradle.patched"
  overlay "$VIRO_TGZ" "$RV"
  cp "$OUT/viro_renderer.build.gradle.patched" "$RV/android/viro_renderer/build.gradle"

  overlay "$VX_PACKS"/viro-external-core-*.tgz "$APP/node_modules/@viro-external/core"
  overlay "$VX_PACKS"/viro-external-media-*.tgz "$APP/node_modules/@viro-external/media"
  overlay "$VX_PACKS"/viro-external-ui-*.tgz "$APP/node_modules/@viro-external/ui"
  overlay "$VX_PACKS"/viro-external-xr-contract-*.tgz "$APP/node_modules/@viro-external/xr-contract"
  echo "$APP_STAMP" >"$APP.stamp"
fi
grep -q "moyoViroRendererAar" "$RV/android/viro_renderer/build.gradle" || die "renderer property hook lost in overlay"

# apps/mobile/android/build.gradle pins vendors/viro-renderer-034d3b9.aar and
# fails on any other SHA-256. Swap the file and its digest; nothing else in
# the Gradle files changes. The diff is saved next to the logs.
PINNED="$APP/vendors/viro-renderer-034d3b9.aar"
OLD_DIGEST="$(sha256 "$PINNED")"
cp "$RENDERER_AAR" "$PINNED"
NEW_DIGEST="$(sha256 "$PINNED")"
sed -i '' "s/$OLD_DIGEST/$NEW_DIGEST/" "$APP/apps/mobile/android/build.gradle"
grep -q "$NEW_DIGEST" "$APP/apps/mobile/android/build.gradle" || die "renderer digest pin not updated"

# Render-quality cell: the meta-data the viro plugin would write from
# android.openxr, added to this flavor's manifest.
declare -a META=()
[[ -n "$SCALE" ]] && META+=("com.viro.openxr.eyeBufferScale=$SCALE")
[[ -n "$FOVEATION" ]] && META+=("com.viro.openxr.foveationLevel=$FOVEATION" "com.viro.openxr.foveationDynamic=true")
[[ -n "$REFRESH" ]] && META+=("com.viro.openxr.displayRefreshRate=$REFRESH")
FLAVOR_MANIFEST="$APP/apps/mobile/android/app/src/$PLATFORM/AndroidManifest.xml"
if (( ${#META[@]} > 0 )); then
  lines=""
  for kv in "${META[@]}"; do
    lines+="    <meta-data android:name=\"${kv%%=*}\" android:value=\"${kv#*=}\"/>\n"
  done
  # First </application> only: the flavor manifest has exactly one.
  awk -v add="$lines" '!done && /<\/application>/ { printf "%s", add; done = 1 } { print }' "$FLAVOR_MANIFEST" >"$FLAVOR_MANIFEST.tmp"
  mv "$FLAVOR_MANIFEST.tmp" "$FLAVOR_MANIFEST"
fi
git -C "$APP" diff -- apps/mobile/android >"$LOG_DIR/app-android.diff"

# 5. Release build. Old outputs go first so a stale APK can never be picked
# up. The app signs release with its committed debug keystore
# (apps/mobile/android/app/build.gradle signingConfigs), so every APK shares
# one signature and no secret is involved.
step "assemble${FLAVOR_CAP}Release"
rm -rf "$APP/apps/mobile/android/app/build/outputs/apk"
start_s=$SECONDS
set +e
# -x lintVitalAnalyze...: the react_viro shim's AGP 8.12 guard disables every
# task named bundle*Aar, which includes bundle<Variant>LocalLintAar, so lint
# vital fails on a missing local_aar_for_lint/out.aar (same shim at viro
# 99b1d87c and in the app's vendored 3.0.1-moyo.1). Lint does not change the
# APK; both stacks skip it.
(cd "$APP/apps/mobile/android" && ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a \
  ./gradlew ":app:assemble${FLAVOR_CAP}Release" -x ":app:lintVitalAnalyze${FLAVOR_CAP}Release" --no-daemon) \
  >"$LOG_DIR/app-$PLATFORM.log" 2>&1
rc=$?
set -e
APP_BUILD_S=$(( SECONDS - start_s ))
echo "app gradle exit=$rc (${APP_BUILD_S}s)" >&2
(( rc == 0 )) || die "app build failed; see $LOG_DIR/app-$PLATFORM.log"
APK="$APP/apps/mobile/android/app/build/outputs/apk/$PLATFORM/release/app-$PLATFORM-release.apk"
[[ -f "$APK" ]] || die "no APK at $APK; check the path Gradle printed in $LOG_DIR/app-$PLATFORM.log"
cp "$APK" "$FINAL"

# The release bundle must carry the app origin, or the app throws at startup
# ("API_URL: neither ... is set") and React tears the tree down. Hermes keeps
# string literals as plain bytes, so a fixed-string grep finds it.
BUNDLE="$OUT/bundle-$PLATFORM.hbc"
unzip -p "$FINAL" assets/index.android.bundle >"$BUNDLE" || die "no assets/index.android.bundle in $FINAL"
[[ -s "$BUNDLE" ]] || die "empty JS bundle in $FINAL"
if grep -a -q -F -- "$APP_ORIGIN" "$BUNDLE"; then BUNDLE_APP_URL=present; else BUNDLE_APP_URL=absent; fi
rm -f "$BUNDLE"
if [[ "$BUNDLE_APP_URL" != present ]]; then
  rm -f "$FINAL"
  die "the JS bundle has no app URL from $APP_ENV_FILE; this APK would crash at launch"
fi

# 6. Prove the APK carries this stack's renderer. AGP may strip the .so again,
# so the bytes can differ; the GNU build ID survives stripping and must match.
APK_SO="$OUT/apk-$PLATFORM.so"
unzip -p "$FINAL" lib/arm64-v8a/libviro_renderer.so >"$APK_SO"
APK_SO_SHA="$(sha256 "$APK_SO")"
APK_SO_BUILDID="$(build_id "$APK_SO")"
[[ -n "$AAR_SO_BUILDID" && "$APK_SO_BUILDID" == "$AAR_SO_BUILDID" ]] \
  || die "APK libviro_renderer.so build ID $APK_SO_BUILDID != built renderer $AAR_SO_BUILDID (stale .so)"
# Second, independent check: #112 added the eye-buffer log line, so its format
# string is present in the candidate and absent in the baseline.
# grep the file directly: `strings | grep -q` under pipefail reports a match as
# a failure (grep exits early, strings gets SIGPIPE), so "present" read "absent".
if grep -a -q "Eye %u: recommended" "$APK_SO"; then EYE_LINE=present; else EYE_LINE=absent; fi
if [[ "$STACK" == candidate && "$EYE_LINE" != present ]] || [[ "$STACK" == baseline && "$EYE_LINE" != absent ]]; then
  die "eye-buffer log string is $EYE_LINE in a $STACK APK; wrong renderer"
fi

# 7. Prove the merged manifest carries exactly this cell's render-quality keys.
"$AAPT2" dump xmltree --file AndroidManifest.xml "$FINAL" >"$LOG_DIR/merged-manifest.txt"
MANIFEST_KEYS="$(node -e '
  const lines = require("fs").readFileSync(process.argv[1], "utf8").split("\n");
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/:name\([^)]*\)="(com\.viro\.openxr\.[A-Za-z]+)"/);
    if (!m) continue;
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const v = lines[j].match(/:value\([^)]*\)=(.*)$/);
      if (v) { out[m[1]] = v[1].replace(/ \(Raw: .*\)$/, "").replace(/^"|"$/g, ""); break; }
    }
  }
  process.stdout.write(JSON.stringify(out));
' "$LOG_DIR/merged-manifest.txt")"
node -e '
  const got = JSON.parse(process.argv[1]);
  const want = {};
  for (const kv of process.argv.slice(2)) { const i = kv.indexOf("="); want[kv.slice(0, i)] = kv.slice(i + 1); }
  const same = (k, a, b) => {
    if (a === b) return true;
    if (k.endsWith("eyeBufferScale")) {
      // aapt stores "1.0" as a float; aapt2 may print it as 1.0 or as raw bits.
      const buf = Buffer.alloc(4); buf.writeFloatBE(parseFloat(b));
      return parseFloat(a) === parseFloat(b) || a.toLowerCase().includes("0x" + buf.toString("hex"));
    }
    if (k.endsWith("foveationDynamic")) return /true|0xffffffff/i.test(a) === (b === "true");
    if (k.endsWith("displayRefreshRate") && b !== "highest") return parseFloat(a) === parseFloat(b);
    return false;
  };
  const keys = new Set([...Object.keys(got), ...Object.keys(want)]);
  for (const k of keys) {
    if (!(k in want)) { console.error(`unexpected ${k}=${got[k]} in APK manifest`); process.exit(1); }
    if (!(k in got)) { console.error(`missing ${k} in APK manifest`); process.exit(1); }
    if (!same(k, got[k], want[k])) { console.error(`${k}: APK has ${got[k]}, wanted ${want[k]}`); process.exit(1); }
  }
' "$MANIFEST_KEYS" ${META[@]+"${META[@]}"} || die "render-quality meta-data in the APK does not match cell $CELL"

# 8. Record the build in out/manifest.json (one entry per APK name).
APK_SHA="$(sha256 "$FINAL")"
BRIDGE_SHA="$(sha256 "$RV/android/react_viro/react_viro-release.aar")"
RIVE_COMMIT="$(cat "$OUT/virocore/android/rive/RIVE_RUNTIME_COMMIT" 2>/dev/null || echo n/a)"
VIRO_TGZ_NAME="$(basename "$VIRO_TGZ")"
RENDERER_AAR_SHA="$(sha256 "$RENDERER_AAR")"
PNPM_V="viro-external $(node -p 'require(process.argv[1]).packageManager' "$OUT/viro-external/package.json"), app $(node -p 'require(process.argv[1]).packageManager' "$APP/package.json") (npx)"
JAVA_V="$(java -version 2>&1 | head -1)"
export APP_SHA VIROCORE_SHA VIRO_SHA VIRO_EXTERNAL_SHA RIVE_COMMIT VIRO_TGZ_NAME RENDERER_AAR_SHA \
  AAR_SO_SHA AAR_SO_BUILDID APK_SO_SHA APK_SO_BUILDID EYE_LINE BRIDGE_SHA APK_SHA APP_BUILD_S \
  PNPM_V JAVA_V NDK_READELF AAPT2 BUNDLE_APP_URL
ENTRY="$(node -e '
  const [name, stack, platform, cell, metaJson] = process.argv.slice(1, 6);
  const e = process.env;
  console.log(JSON.stringify({
    name, apk: `${name}.apk`, stack, flavor: platform, variant: `${platform}Release`, cell,
    renderQualityMetaData: JSON.parse(metaJson),
    builtAtUtc: new Date().toISOString(),
    shas: { app: e.APP_SHA, virocore: e.VIROCORE_SHA, viro: e.VIRO_SHA, viroExternal: e.VIRO_EXTERNAL_SHA, riveRuntime: e.RIVE_COMMIT },
    viroTarball: e.VIRO_TGZ_NAME,
    rendererAarSha256: e.RENDERER_AAR_SHA,
    aarLibViroRenderer: { sha256: e.AAR_SO_SHA, gnuBuildId: e.AAR_SO_BUILDID },
    apkLibViroRenderer: { sha256: e.APK_SO_SHA, gnuBuildId: e.APK_SO_BUILDID },
    eyeBufferLogString: e.EYE_LINE,
    bundleAppUrl: e.BUNDLE_APP_URL,
    reactViroBridgeAarSha256: e.BRIDGE_SHA,
    apkSha256: e.APK_SHA,
    appGradleSeconds: Number(e.APP_BUILD_S),
    signing: "app debug keystore (apps/mobile/android/app/build.gradle)",
    env: { node: process.version, pnpm: e.PNPM_V, java: e.JAVA_V, ndkReadelf: e.NDK_READELF, aapt2: e.AAPT2 },
  }));
' "$NAME" "$STACK" "$PLATFORM" "$CELL" "$MANIFEST_KEYS")"
export ENTRY
node -e '
  const fs = require("fs"); const p = process.argv[1];
  const list = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : [];
  const e = JSON.parse(process.env.ENTRY);
  const out = list.filter((x) => x.name !== e.name); out.push(e);
  out.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + "\n");
' "$DIST/manifest.json"
echo "$ENTRY" | node -e 'process.stdout.write(JSON.stringify(JSON.parse(require("fs").readFileSync(0,"utf8")), null, 2) + "\n")'

# 9. Only out/ stays: drop this stack's clones and build dirs once the APK is
# verified. Gradle's shared cache (~/.gradle) and the pnpm store are not here.
if [[ "$KEEP_SOURCES" == 1 ]]; then
  echo "build-stack: KEEP_SOURCES=1, keeping $OUT ($(du -sh "$OUT" | awk '{print $1}'))" >&2
else
  echo "build-stack: removing $OUT ($(du -sh "$OUT" | awk '{print $1}'))" >&2
  rm -rf "$OUT" "$OUT".stamp
fi
