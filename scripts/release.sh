#!/usr/bin/env bash
# Merge check, cut and tag for the GitHub release of virocore, the react-viro
# fork (mikevocalz/viro), viro-external and expo-pico. Nothing goes to npm.
# RELEASE.md explains each step.
#
#   scripts/release.sh          check only: reads GitHub, pushes nothing (default)
#   scripts/release.sh --push   same checks, then creates the tags and dispatches
#                               expo-pico's release-branches workflow
#
# Needs: bash, gh (logged in, read access to all four repos), node.
# No clones: everything is read through the GitHub API.
#
# Before the PRs merge, the script previews the release at the PR heads.
# --push refuses to do anything until every PR in MERGE_ORDER is merged and
# its checks passed, and then works from each repo's main.
#
# Overrides: OWNER (default mikevocalz), VX_TAG (default release-<UTC date>).

set -euo pipefail

PUSH=0
case "${1:-}" in
  "") ;;
  --push) PUSH=1 ;;
  -h | --help) sed -n '2,17p' "$0"; exit 0 ;;
  *) echo "usage: $0 [--push]" >&2; exit 2 ;;
esac

OWNER="${OWNER:-mikevocalz}"
VX_TAG="${VX_TAG:-release-$(date -u +%Y-%m-%d)}"

# repo|PR, in merge order. virocore #116 targets moyo/renderer-73c6a92; every
# other PR here targets main, except expo-pico #45, which is stacked on #43.
MERGE_ORDER='
virocore|116
virocore|118
virocore|119
viro|83
viro|84
viro-external|80
viro-external|81
expo-pico|43
expo-pico|44
expo-pico|45
'

# repo|contained PR|containing PR: the second PR's head already includes the
# first's, so merging the second after the first adds only its own commits.
STACKS='
viro|83|84
viro-external|80|81
expo-pico|43|45
'

FAIL=0
fail() { echo "  FAIL: $*"; FAIL=1; }
log() { printf '\n==> %s\n' "$*"; }

pr_field() { gh pr view "$2" -R "$OWNER/$1" --json "$3" --jq ".$3"; }

# Prints identical/ahead/behind/diverged for base...head.
compare() {
  local out
  out="$(gh api "repos/$OWNER/$1/compare/$2...$3" --jq .status 2>/dev/null)" || { echo missing; return 0; }
  printf '%s\n' "$out"
}

# gh api prints the error body on stdout for a 404, so test its exit code.
file_at() {
  local b64
  b64="$(gh api "repos/$OWNER/$1/contents/$2?ref=$3" --jq .content 2>/dev/null)" || return 0
  printf '%s' "$b64" | base64 --decode
}

tag_sha() {
  local out
  out="$(gh api "repos/$OWNER/$1/git/ref/tags/$2" --jq .object.sha 2>/dev/null)" || return 0
  printf '%s' "$out"
}

main_sha() { gh api "repos/$OWNER/$1/commits/main" --jq .sha; }

command -v gh >/dev/null || { echo "gh is required" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in" >&2; exit 1; }

log "1. PRs in merge order"
ALL_MERGED=1
while IFS='|' read -r repo pr; do
  [ -n "$repo" ] || continue
  info="$(gh pr view "$pr" -R "$OWNER/$repo" --json state,isDraft,baseRefName,headRefName,headRefOid,mergeable,statusCheckRollup \
    --jq '[.state, (.isDraft|tostring), .baseRefName, .headRefName, .headRefOid[0:7], .mergeable,
           ([.statusCheckRollup[] | if (.conclusion // "") != "" then .conclusion elif (.state // "") != "" then .state else "PENDING" end] | group_by(.) | map("\(.[0])=\(length)") | join(","))] | join("|")')"
  IFS='|' read -r state draft base head sha mergeable checks <<<"$info"
  printf '  %-13s #%-4s %-6s draft=%-5s %s@%s -> %s  mergeable=%s  checks: %s\n' \
    "$repo" "$pr" "$state" "$draft" "$head" "$sha" "$base" "$mergeable" "${checks:-none}"
  [ "$state" = MERGED ] || ALL_MERGED=0
  if [ "$state" = OPEN ]; then
    case "$mergeable" in CONFLICTING) fail "$repo #$pr conflicts with $base" ;; esac
    case ",$checks," in *,FAILURE=*|*,CANCELLED=*|*,TIMED_OUT=*|*,ERROR=*) fail "$repo #$pr has failing checks" ;; esac
  fi
done <<<"$MERGE_ORDER"

log "2. Stacked PRs"
while IFS='|' read -r repo inner outer; do
  [ -n "$repo" ] || continue
  a="$(pr_field "$repo" "$inner" headRefOid)"
  b="$(pr_field "$repo" "$outer" headRefOid)"
  st="$(compare "$repo" "$a" "$b")"
  case "$st" in
    ahead | identical) echo "  $repo #$outer (${b:0:7}) contains #$inner (${a:0:7})" ;;
    *) fail "$repo #$outer (${b:0:7}) does not contain #$inner (${a:0:7}): $st" ;;
  esac
done <<<"$STACKS"

# Release sources: each repo's main once everything merged, else the last PR head.
if [ "$ALL_MERGED" = 1 ]; then
  MODE_NOTE="main (all PRs merged)"
  VIRO_SRC="$(main_sha viro)"
  VX_SRC="$(main_sha viro-external)"
  EP_SRC="$(main_sha expo-pico)"
  VIROCORE_SRC="$(main_sha virocore)"
else
  MODE_NOTE="PR heads (preview; PRs not merged)"
  VIRO_SRC="$(pr_field viro 84 headRefOid)"
  VX_SRC="$(pr_field viro-external 81 headRefOid)"
  EP_SRC="$(pr_field expo-pico 45 headRefOid)"
  VIROCORE_SRC="$(main_sha virocore)"
fi

log "3. Release sources: $MODE_NOTE"
echo "  virocore       ${VIROCORE_SRC:0:7} (main; #118/#119 land here, #116 lands on moyo/renderer-73c6a92)"
echo "  viro           ${VIRO_SRC:0:7}"
echo "  viro-external  ${VX_SRC:0:7}"
echo "  expo-pico      ${EP_SRC:0:7}"

log "4. viro-external source pins (Viro / ViroCore)"
# The pins live in scripts/sync-viro-3-1.sh and scripts/ci/check-viro-access.mjs
# (viro-external #78). Read them from main when #78 has merged, else from #78.
PIN_REF=main
if [ -z "$(file_at viro-external scripts/sync-viro-3-1.sh main)" ]; then
  PIN_REF="$(pr_field viro-external 78 headRefOid)"
  echo "  #78 not merged; reading pins from its head ${PIN_REF:0:7}"
fi
sync_sh="$(file_at viro-external scripts/sync-viro-3-1.sh "$PIN_REF")"
access_js="$(file_at viro-external scripts/ci/check-viro-access.mjs "$PIN_REF")"
pin_viro="$(printf '%s\n' "$sync_sh" | sed -n 's/^readonly VIRO_SHA="\([0-9a-f]*\)".*/\1/p')"
pin_virocore="$(printf '%s\n' "$sync_sh" | sed -n 's/^readonly VIROCORE_SHA="\([0-9a-f]*\)".*/\1/p')"
pin_access="$(printf '%s\n' "$access_js" | sed -n "s/^export const VIRO_REVISION = '\([0-9a-f]*\)'.*/\1/p")"
[ -n "$pin_viro" ] || fail "no VIRO_SHA in sync-viro-3-1.sh at ${PIN_REF:0:7}"
[ -n "$pin_virocore" ] || fail "no VIROCORE_SHA in sync-viro-3-1.sh at ${PIN_REF:0:7}"
if [ -n "$pin_viro" ]; then
  [ "$pin_viro" = "$pin_access" ] || fail "sync script pins viro ${pin_viro:0:7}, check-viro-access pins ${pin_access:0:7}"
  st="$(compare viro "$pin_viro" "$VIRO_SRC")"
  case "$st" in
    identical) echo "  viro pin ${pin_viro:0:7} = release source" ;;
    ahead) echo "  viro pin ${pin_viro:0:7} is behind the release source ${VIRO_SRC:0:7}: bump it after the viro merge" ;;
    *) fail "viro pin ${pin_viro:0:7} vs ${VIRO_SRC:0:7}: $st" ;;
  esac
fi
if [ -n "$pin_virocore" ]; then
  st="$(compare virocore "$pin_virocore" "$VIROCORE_SRC")"
  case "$st" in
    identical) echo "  virocore pin ${pin_virocore:0:7} = virocore main" ;;
    ahead) echo "  virocore pin ${pin_virocore:0:7} is behind virocore main ${VIROCORE_SRC:0:7}: bump it after the virocore merges" ;;
    *) fail "virocore pin ${pin_virocore:0:7} vs main ${VIROCORE_SRC:0:7}: $st" ;;
  esac
fi

log "5. Tags"
viro_version="$(file_at viro package.json "$VIRO_SRC" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))')"
VIRO_TAG="v$viro_version"
TAGS="viro|$VIRO_TAG|$VIRO_SRC
viro-external|$VX_TAG|$VX_SRC"
while IFS='|' read -r repo tag sha; do
  existing="$(tag_sha "$repo" "$tag")"
  if [ -n "$existing" ]; then
    echo "  $repo $tag already exists (${existing:0:7}); not moving it"
  else
    echo "  $repo $tag -> ${sha:0:7} (would create)"
  fi
done <<<"$TAGS"
echo "  virocore: no tag. Its release.yml runs on every tag push, and the renderer"
echo "            binaries viro ships are rebuilt by hand (see RELEASE.md)."
echo "  expo-pico: release-branches.yml tags each package on push to main."

log "6. expo-pico release branches"
rel_head="$(file_at expo-pico package.json release/core | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s);console.log((m.expoPico&&m.expoPico.sourceCommit)||m.gitHead||"")})')"
echo "  release/core was cut from ${rel_head:0:7}; release source is ${EP_SRC:0:7}"
if [ "$rel_head" != "$EP_SRC" ]; then
  echo "  release/* is behind: the next push to main (or a dispatch of release-branches.yml) recuts it"
fi

if [ "$FAIL" = 1 ]; then
  log "Checks failed; nothing pushed"
  exit 1
fi

if [ "$PUSH" = 0 ]; then
  log "Check mode: nothing pushed. Rerun with --push after every PR has merged."
  exit 0
fi

log "7. Push"
[ "$ALL_MERGED" = 1 ] || { echo "  refusing --push: not every PR in the merge order is merged" >&2; exit 1; }
while IFS='|' read -r repo tag sha; do
  if [ -n "$(tag_sha "$repo" "$tag")" ]; then
    echo "  $repo $tag exists; skipped"
    continue
  fi
  obj="$(gh api "repos/$OWNER/$repo/git/tags" -f tag="$tag" -f message="$repo $tag from $sha" \
    -f object="$sha" -f type=commit --jq .sha)"
  gh api "repos/$OWNER/$repo/git/refs" -f ref="refs/tags/$tag" -f sha="$obj" >/dev/null
  echo "  created $repo $tag -> ${sha:0:7}"
done <<<"$TAGS"
if [ "$rel_head" != "$EP_SRC" ]; then
  gh workflow run release-branches.yml -R "$OWNER/expo-pico" --ref main
  echo "  dispatched expo-pico release-branches.yml on main"
fi
log "Done"
