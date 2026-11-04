#!/usr/bin/env bash
# Keep the Viro 3.1.0 / ViroCore 3.1.0 sources next to viro-external.
# Safe by design: no forced checkout, resets, discarded local changes or manual Gradle edits.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"

sync_repo() {
  local name="$1"
  local dir="$PARENT/$name"
  local origin="https://github.com/mikevocalz/$name.git"

  if [[ ! -e "$dir" ]]; then
    git clone --branch main "$origin" "$dir"
  else
    git -C "$dir" rev-parse --is-inside-work-tree >/dev/null ||
      { printf 'ERROR: %s exists but is not a Git checkout\n' "$dir" >&2; return 1; }
    if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then
      printf 'ERROR: %s has local changes. Commit/stash them first; no files were reset.\n' "$dir" >&2
      return 1
    fi

    local remote
    remote="$(git -C "$dir" remote get-url origin)"
    case "$remote" in
      "https://github.com/mikevocalz/$name"|"https://github.com/mikevocalz/$name.git"|"git@github.com:mikevocalz/$name"|"git@github.com:mikevocalz/$name.git") ;;
      *) printf 'ERROR: unexpected origin for %s: %s\n' "$name" "$remote" >&2; return 1 ;;
    esac

    git -C "$dir" fetch --no-tags origin main
    git -C "$dir" checkout main
    git -C "$dir" merge --ff-only origin/main
  fi
}

sync_repo viro
sync_repo virocore

node - "$PARENT/viro/package.json" "$PARENT/virocore/RELEASE_NOTES.md" <<'NODE'
const fs = require('node:fs');
const packagePath = process.argv[2];
const notesPath = process.argv[3];
const viro = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const virocoreNotes = fs.readFileSync(notesPath, 'utf8');
if (!viro.version.startsWith('3.1.0-moyo.')) {
  throw Error('Expected Expo SDK 58 Viro 3.1.0 Moyo fork; found ' + viro.version);
}
if (!/^## v3\.1\.0\b/m.test(virocoreNotes)) {
  throw Error('ViroCore checkout does not advertise v3.1.0. Stop before building.');
}
console.log('Viro source: ' + viro.version + ' (Expo SDK 58 / RN 0.88 fork)');
console.log('ViroCore source: v3.1.0');
console.log('Native AARs, iOS/visionOS frameworks and web/WASM still require separate builds and validation.');
NODE

printf 'Viro SHA: '; git -C "$PARENT/viro" rev-parse HEAD
printf 'ViroCore SHA: '; git -C "$PARENT/virocore" rev-parse HEAD
