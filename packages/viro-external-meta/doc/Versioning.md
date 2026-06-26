# Versioning

`@viro-external/meta` follows **semver** discipline aligned with its sibling packages:

- Patch bump: sibling patch upgrade(s), doc fix, no API change.
- Minor bump: new subpath, new sibling minor (new component/export available).
- Major bump: removed sibling re-export, signature change in a sibling, or peer bump.

The three siblings (`react-native-viro-mux`, `@viro-external/core`, `@viro-external/gui`) are pinned to **exact** versions in `dependencies` — not ranges. A sibling bump is a deliberate change here.

## When a sibling renames or removes an export

Stop. Do not silently drop it. Open an issue, bump major, document the migration. The `doc/Imports.md` table is the source of truth; PR that to match the new sibling reality first.
