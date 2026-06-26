# AGENTS — react-native-viro-mux

Rules every agent must follow when touching this repo:

1. Read `config/defaults.json` before touching any tunable. No magic numbers inline anywhere.
2. Never invent a native or JS API. If a symbol cannot be located in the real source, stop and say so.
3. Clone and read the real `ReactVision/viro` + `ReactVision/virocore` source before writing any native binding.
4. No stubs, TODOs, or placeholder bodies in delivered code. An unimplemented file does not ship; it stays in `TASKS.md` until real.
5. `npx tsc --noEmit` must pass before any task is marked done.
6. `doc/` wins over `README` if they disagree. `doc/TextureBridge.md` is the load-bearing spec.
7. The TS surface in `src/contract.ts` is **frozen**. Other packages import it. Changes require a `doc/TextureBridge.md` changelog entry at the top.

## Verified upstream versions (npm, checked at scaffold time)

- `@reactvision/react-viro`: `2.56.0`
- `react-native`: `0.86.0`
- `expo`: `56.0.12`
- `react-native-nitro-modules`: `0.35.9`

Re-verify with `npm view <pkg> version` before bumping.
