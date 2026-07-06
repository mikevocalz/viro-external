# CLAUDE — standing preferences (render-passes)

Inherits the workspace root preferences. render-passes-specific additions:

- Native C++ lives in `native/` (does not exist yet — spec-only day one).
  TypeScript bridge in `src/`. None of these directories cross-pollute.
- Zustand store key: `render-passes`. Never mutate the store outside its
  selectors and actions.
- No `useEffect` for native lifecycle — use the `registerRenderPass` /
  `unregisterRenderPass` pair so the native bridge owns the lifecycle.
- Do NOT read `VROChoreographer::_customPostOpaquePass` twice per process
  and diff-check. The multiplex owns the slot. Any second attach attempt
  from a child package is a bug in that package, not something to work
  around here.
- The spec at `doc/DECA-unified-render-pass-spec.md` is authoritative.
  If a code change contradicts it, update the spec first (with a new
  SEAM entry if necessary), then write the code.

## When debugging on device

The host app (`decax9`) lives at `/Users/mikevocalz/decax9`. Build with
`npm run android:pico` from that directory after dropping a fresh
`viro_renderer-release.aar` into `/Users/mikevocalz/viro/android/viro_renderer/`.

Logs filter on tag `Viro` (the renderer's `pinfo` macro). Multiplex
specific lines are prefixed `MultiplexPass:`.
