# CLAUDE — standing preferences (splat-pass)

Inherits the workspace root preferences. Splat-pass-specific additions:

- Native C++ lives in `native/`. TypeScript bridge in `src/`. Shaders in
  `shaders/`. None of these directories cross-pollute.
- Zustand store key: `splat-pass`. Never mutate the store outside its
  selectors and actions.
- All GL state mutations go through `GLStateScope`. Naked `glEnable` /
  `glDisable` / `glBindBuffer` outside the RAII scope is a review-block.
- Compute dispatches are sized off the live `splatCount` from the store;
  never compile-time constants.
- No `useEffect` for native lifecycle — use the `registerSplatPass` /
  `unregisterSplatPass` pair so the native bridge owns the lifecycle.

## When debugging on device

The host app (`decax9`) lives at `/Users/mikevocalz/decax9`. Build with
`npm run android:pico` from that directory after dropping a fresh
`viro_renderer-release.aar` into `/Users/mikevocalz/viro/android/viro_renderer/`.

Logs filter on tag `Viro` (the renderer's `pinfo` macro). Splat-pass
specific lines are prefixed `SplatPass:`.
