#!/usr/bin/env bash
# Publishes expo-pico, the react-viro fork and viro-external in dependency
# order. See RELEASE.md for the version table and the preconditions.
#
#   scripts/release.sh --pack       build and pack every tarball, no registry contact
#   scripts/release.sh --dry-run    --pack, then `npm publish --dry-run` per tarball (default)
#   scripts/release.sh --publish    --pack, then publish for real
#
# Checkouts (each at the merged release commit, clean tree):
#   VIRO_EXTERNAL_DIR  default: this repository
#   VIRO_DIR           default: ../viro
#   EXPO_PICO_DIR      default: ../expo-pico
#
# SKIP_INSTALL=1 reuses existing node_modules. ALLOW_DIRTY=1 skips the
# clean-tree check. Both exist for local rehearsal, not for a real publish.
#
# The script stops at the first failure. A rerun skips every name@version
# the registry already has, so it resumes where it stopped.

set -euo pipefail

MODE="${1:---dry-run}"
case "$MODE" in
  --pack | --dry-run | --publish) ;;
  *) echo "usage: $0 [--pack|--dry-run|--publish]" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIRO_EXTERNAL_DIR="${VIRO_EXTERNAL_DIR:-$ROOT}"
VIRO_DIR="${VIRO_DIR:-$ROOT/../viro}"
EXPO_PICO_DIR="${EXPO_PICO_DIR:-$ROOT/../expo-pico}"
OUT="${OUT:-$(mktemp -d "${TMPDIR:-/tmp}/viro-release.XXXXXX")}"
mkdir -p "$OUT"

# name|version|dist-tag|repo|package dir (relative to the repo), in publish order.
# alpha: the package, or something it depends on, peers on Nitro
#        1.0.0-alpha.nightly.120. next: everything else in this release.
PLAN='
@viro-external/xr-contract|0.3.0|next|vx|packages/xr-platform-contract
@viro-external/specs|0.3.0|next|vx|packages/specs
@viro-external/meta-layout|0.1.0|next|vx|packages/meta-layout
@viro-external/spatial-shell|0.1.0|next|vx|packages/spatial-shell
@reactvision/react-viro|3.1.0-moyo.0|next|viro|.
react-native-viro-mux|0.1.1|alpha|vx|packages/react-native-viro-mux
@viro-external/splat-pass|0.0.1|alpha|vx|packages/splat-pass
@viro-external/core|0.1.0|alpha|vx|packages/viro-external-core
@viro-external/media|0.1.0|next|vx|packages/media
@viro-external/ui|0.1.0|alpha|vx|packages/ui
@viro-external/gui|0.1.0|alpha|vx|packages/viro-external-gui
@viro-external/meta|0.1.0|alpha|vx|packages/viro-external-meta
@viro-external/meta-wearables|0.1.0|next|vx|packages/meta-wearables
@viro-external/native-panels|0.1.0|alpha|vx|packages/native-panels
@viro-external/openxr|0.1.0|next|vx|packages/openxr
@viro-external/render-passes|0.0.0|alpha|vx|packages/render-passes
@viro-external/orb-pass|0.0.1|alpha|vx|packages/orb-pass
@viro-external/pano|0.2.0|next|vx|packages/pano
@viro-external/pico-layout|0.1.0|next|vx|packages/pico-layout
@viro-external/premium|0.1.0|alpha|vx|packages/premium
@viro-external/spatial-panels|0.1.0|next|vx|packages/spatial-panels
@viro-external/spatial-runtime|0.1.0|next|vx|packages/spatial-runtime
@viro-external/viture|0.1.0|next|vx|packages/viture
@viro-external/web-layout|0.1.0|next|vx|packages/web-layout
@viro-external/webspatial|0.1.0|next|vx|packages/webspatial
react-native-viro-webrtc|0.1.0|next|vx|packages/react-native-viro-webrtc
@expo-pico/platform-service-common|1.0.0|alpha|ep|packages/internal/pico-platform-service-common
@expo-pico/core|2.0.0-alpha.0|alpha|ep|packages/expo-pico-core
@expo-pico/spatial|2.0.0-alpha.0|alpha|ep|packages/expo-pico-spatial
@expo-pico/account|2.0.0-alpha.0|alpha|ep|packages/expo-pico-account
@expo-pico/iap|2.0.0-alpha.0|alpha|ep|packages/expo-pico-iap
@expo-pico/notifications|2.0.0-alpha.0|alpha|ep|packages/expo-pico-notifications
@expo-pico/rtc|2.0.0-alpha.0|alpha|ep|packages/expo-pico-rtc
@expo-pico/rooms|2.0.0-alpha.0|alpha|ep|packages/expo-pico-rooms
@expo-pico/subscription|2.0.0-alpha.0|alpha|ep|packages/expo-pico-subscription
@expo-pico/storage|2.0.0-alpha.0|alpha|ep|packages/expo-pico-storage
@expo-pico/social|2.0.0-alpha.0|alpha|ep|packages/expo-pico-social
@expo-pico/achievements|2.0.0-alpha.0|alpha|ep|packages/expo-pico-achievements
@expo-pico/leaderboards|2.0.0-alpha.0|alpha|ep|packages/expo-pico-leaderboards
@expo-pico/app-kit|2.0.0-alpha.0|alpha|ep|packages/expo-pico-app-kit
@expo-pico/template|0.1.2-alpha.0|alpha|ep|packages/expo-pico-template
'

repo_dir() {
  case "$1" in
    vx) echo "$VIRO_EXTERNAL_DIR" ;;
    viro) echo "$VIRO_DIR" ;;
    ep) echo "$EXPO_PICO_DIR" ;;
  esac
}

log() { printf '\n==> %s\n' "$*"; }

log "Preflight"
node -e 'const [maj]=process.versions.node.split(".").map(Number); if (maj < 22) { console.error("Node >= 22 required, found " + process.version); process.exit(1) }'
for r in vx viro ep; do
  d="$(repo_dir "$r")"
  [ -f "$d/package.json" ] || { echo "missing checkout for $r: $d" >&2; exit 1; }
  if [ "${ALLOW_DIRTY:-0}" != 1 ] && [ -n "$(git -C "$d" status --porcelain --untracked-files=no)" ]; then
    echo "$d has uncommitted changes" >&2; exit 1
  fi
  echo "$r: $d @ $(git -C "$d" rev-parse --short HEAD)"
done
if [ "$MODE" = --publish ]; then
  npm whoami >/dev/null || { echo "npm whoami failed: log in first" >&2; exit 1; }
fi

PROVENANCE=()
if [ "${GITHUB_ACTIONS:-}" = true ]; then
  PROVENANCE=(--provenance)
fi

if [ "${SKIP_INSTALL:-0}" != 1 ]; then
  log "Install"
  (cd "$VIRO_EXTERNAL_DIR" && pnpm install --frozen-lockfile)
  (cd "$VIRO_DIR" && npm ci)
  (cd "$EXPO_PICO_DIR" && yarn install --frozen-lockfile)
fi

log "Pack into $OUT"
TARBALLS=()
while IFS='|' read -r name version tag repo dir; do
  [ -n "$name" ] || continue
  pkg="$(repo_dir "$repo")/$dir"
  before="$(ls "$OUT")"
  if [ "$repo" = vx ]; then
    # pnpm pack rewrites workspace:* ranges and applies publishConfig.
    (cd "$pkg" && pnpm pack --pack-destination "$OUT" >/dev/null)
  else
    (cd "$pkg" && npm pack --pack-destination "$OUT" >/dev/null)
  fi
  tgz="$(comm -13 <(printf '%s\n' "$before") <(ls "$OUT") | head -n1)"
  [ -n "$tgz" ] || { echo "no tarball produced for $name" >&2; exit 1; }
  manifest="$(tar -xOzf "$OUT/$tgz" package/package.json)"
  got="$(node -e 'const m=JSON.parse(process.argv[1]); console.log(m.name + "@" + m.version)' "$manifest")"
  [ "$got" = "$name@$version" ] || { echo "$tgz is $got, expected $name@$version" >&2; exit 1; }
  if printf '%s' "$manifest" | grep -qE '"(workspace|link|file):'; then
    echo "$tgz still has a workspace:, link: or file: range" >&2; exit 1
  fi
  echo "packed $got ($tgz)"
  TARBALLS+=("$name|$version|$tag|$OUT/$tgz")
done <<<"$PLAN"

[ "$MODE" = --pack ] && { log "Packed ${#TARBALLS[@]} tarballs in $OUT"; exit 0; }

log "Publish ($MODE)"
for row in "${TARBALLS[@]}"; do
  IFS='|' read -r name version tag tgz <<<"$row"
  if [ -n "$(npm view "$name@$version" version 2>/dev/null || true)" ]; then
    echo "skip $name@$version: already on the registry"
    continue
  fi
  args=(publish "$tgz" --access public --tag "$tag" ${PROVENANCE[@]+"${PROVENANCE[@]}"})
  [ "$MODE" = --dry-run ] && args+=(--dry-run)
  echo "npm ${args[*]}"
  npm "${args[@]}"
done

log "Done"
