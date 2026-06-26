# AGENTS — @viro-external/meta

Rules:

1. **No components, no native code, no prop massaging.** This package is exclusively pure re-exports.
2. Every re-exported symbol MUST resolve to a real export in its source package. Verify by reading the source `src/index.ts` — never reverse-engineer from memory.
3. If two siblings export the same name, **stop and ask** — do not alias.
4. `sideEffects: false` — keep it so. No imports for side effects allowed.
5. Subpaths in `package.json` `exports` are the public contract. Any addition is a semver minor; any removal is a breaking change.
