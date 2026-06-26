# AGENTS — @viro-external/gui

Same base rules as `react-native-viro-mux` and `@viro-external/core`. In addition:

- **Babylon prop names are the contract.** Match them exactly, do not invent or rename.
- Pointer/hover/click events come from Viro's verified `onHover` / `onClick` / `onClickState`. No invented event props.
- Containers move; children do not wire their own `onDrag`. A child with a movable panel ancestor ignores its own `movable` and logs a dev warning.
- World positions are owned by `SceneZone` — every component defaults to local origin, never `z=-1.5`.
- Zustand for shared state; never `useState` for app state.
