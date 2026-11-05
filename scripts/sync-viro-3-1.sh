#!/usr/bin/env bash
# Reproducible Viro 3.1.0 + ViroCore 3.1.0 source pair for Expo SDK 58.
# Never reset local work, move an unrelated branch, or substitute a newer
# native renderer without its matching React bridge and ABI verification.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"
readonly VIRO_SHA="8075d97bb3584a04a76a0cda7846dfe5fc2ae483"
readonly VIROCORE_SHA="8a5bdc47aa0f47d9c6249461ef5f07fe77fe60ac"

sync_repo() {
  local name="$1"
  local wanted="$2"
  local dir="$PARENT/$name"
  local origin="https://github.com/mikevocalz/$name.git"
  local remote

  if [[ ! -e "$dir" ]]; then
    git clone --branch main "$origin" "$dir"
  else
    git -C "$dir" rev-parse --is-inside-work-tree >/dev/null ||
      { printf 'ERROR: %s exists but is not a Git checkout\n' "$dir" >&2; return 1; }
    if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then
      printf 'ERROR: %s has local changes; commit or stash first. Nothing was reset.\n' "$dir" >&2
      return 1
    fi
    remote="$(git -C "$dir" remote get-url origin)"
    case "$remote" in
      "https://github.com/mikevocalz/$name"|"https://github.com/mikevocalz/$name.git"|"git@github.com:mikevocalz/$name"|"git@github.com:mikevocalz/$name.git") ;;
      *) printf 'ERROR: unexpected origin for %s: %s\n' "$name" "$remote" >&2; return 1 ;;
    esac
  fi

  git -C "$dir" fetch --no-tags origin main
  if ! git -C "$dir" cat-file -e "\${wanted}^{commit}" 2>/dev/null; then
    printf 'ERROR: expected %s revision %s was not fetched\n' "$name" "$wanted" >&2
    return 1
  fi
  if ! git -C "$dir" merge-base --is-ancestor HEAD "$wanted"; then
    printf 'ERROR: %s has a divergent/newer commit. Preserve it; inspect and reconcile manually.\n' "$dir" >&2
    return 1
  fi
  git -C "$dir" checkout --detach "$wanted"
}

sync_repo viro "$VIRO_SHA"
sync_repo virocore "$VIROCORE_SHA"

node - "$PARENT/viro/package.json" "$PARENT/virocore/RELEASE_NOTES.md" <<'NODE'
const fs = require('node:fs');
const viro = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const notes = fs.readFileSync(process.argv[3], 'utf8');
if (!viro.version.startsWith('3.1.0-moyo.')) {
  throw Error('Expected Viro 3.1.0 Moyo SDK 58 fork; found ' + viro.version);
}
if (!/^## v3\.1\.0\b/m.test(notes)) {
  throw Error('ViroCore source is missing the 3.1.0 release notes; stop before building.');
}
console.log('Verified Viro source: ' + viro.version + ' (Expo SDK 58 / RN 0.88 fork)');
console.log('Verified ViroCore source: v3.1.0');
console.log('Source validation alone does not update AARs, Apple frameworks or web/WASM binaries.');
NODE
printf 'Viro revision: '; git -C "$PARENT/viro" rev-parse HEAD
printf 'ViroCore revision: '; git -C "$PARENT/virocore" rev-parse HEAD
