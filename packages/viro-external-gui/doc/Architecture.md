# Architecture — @viro-external/gui

Babylon's `GUI3D` control tree ported to ViroReact. Pure TS — no new native code. Every control composes primitives from:

- `react-native-viro-mux`: `MovableNode`, `ViroGPUTexture`, `MovableProps`.
- `@viro-external/core`: `ViroSlate`, `ViroCylinderSurface`, `buildCylinderGeometry`.
- `@reactvision/react-viro` 2.56.0: `ViroNode`, `ViroQuad`, `ViroBox`, `ViroGeometry`, `ViroText`, `ViroAnimations`.

## Wave 1 (this prompt — shipped)

| Component             | Babylon class             | Composes |
| --------------------- | ------------------------- | -------- |
| `Control3D` (base)    | `Control3D`               | `ViroNode` + Viro events (`onHover`, `onClickState`) |
| `Container3D`         | `Container3D`             | `ViroNode` + layout delegate |
| `Button3D`            | `Button3D`                | `ViroSlate` for content texture + `Control3D` state machine |
| `HolographicButton`   | `HolographicButton`       | `Button3D` + `ViroSlate variant="glass"` plates |
| `StackPanel3D`        | `StackPanel3D`            | `Container3D` + linear `_arrangeChildren` |
| `CylinderPanel`       | `CylinderPanel`           | `Container3D` + `buildCylinderGeometry` arc layout |
| `HolographicSlate`    | `HolographicSlate`        | `ViroSlate` thin wrapper |
| `SceneZone`           | (placement scaffolding)   | `ViroNode` reading from `config.zones` |
| `useGuiStore`         | (Zustand store)           | runtime control state |

## Wave 2 (PROMPT-6) — extension surface

`VolumeBasedPanel` base, `SpherePanel`, `ScatterPanel`, `PlanePanel`, `Slider3D`, `TouchHolographicButton`, `TouchHolographicMenu`, `MeshButton3D`. Each subclasses Wave 1 — the base APIs here must be extension-friendly (especially `Container3D._arrangeChildren`).

## Placement discipline

Hard rule: components default to local origin. World transforms belong to `SceneZone` (see `doc/Composition.md`). The zone table is in `config/defaults.json` → `zones`.

## Movability discipline

Hard rule: containers move; children don't drag loose. Implemented via a React context `MovablePanelContext`. A child control inside a movable panel disables its own `movable` prop and warns in dev.
