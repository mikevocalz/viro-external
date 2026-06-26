# Composition — zones, comfort, movability

## Zone table (canonical)

Head at origin, forward = `-Z`, meters. From `config/defaults.json`:

| Zone              | Position             | Yaw   | Pitch | Use |
| ----------------- | -------------------- | ----- | ----- | --- |
| `primary`         | `[0, -0.10, -1.5]`   | 0°    | 0°    | Single hero element. |
| `peripheralLeft`  | `[-0.96, -0.10, -1.15]` | +40° | 0°   | Secondary, glanceable. |
| `peripheralRight` | `[0.96, -0.10, -1.15]`  | -40° | 0°   | Secondary, glanceable. |
| `dock`            | `[0, -0.55, -1.0]`   | 0°    | +20°  | Controls / toolbar. |
| `statusBar`       | `[0, 0.55, -1.4]`    | 0°    | -12°  | Body-locked status. |
| `nearLeft`        | `[-0.32, -0.32, -0.55]` | 0° | 0°    | Near-hand affordance. |
| `nearRight`       | `[0.32, -0.32, -0.55]`  | 0° | 0°    | Near-hand affordance. |

## Rules

1. **One element in `primary`.** A panel inside `primary` is one element.
2. **Children sit at local origin.** Every component default position is unset; zone parents own the transform.
3. **Comfort envelope.** Primary content depth 1.0–2.0m; within ±30° yaw/pitch; nothing closer than 0.5m except `nearLeft`/`nearRight`. No two parallel panels within 0.3m in Z. Interactive hitboxes ≥ 0.05m apart.
4. **Never default to `z=-1.5`.** Components are placed by zones, not by hand.

## `SceneZone` API

```tsx
import { SceneZone } from "@viro-external/gui";

<SceneZone name="primary">
  <HolographicSlate ... />
</SceneZone>
```

`SceneZone` reads from `config.zones[name]`, applies position + yaw + pitch to a wrapping `ViroNode`, and renders children at local origin.

## Movability rules

- `MovablePanelContext` is set by any movable container (`StackPanel3D`, `CylinderPanel`, `HolographicSlate`, etc).
- A `Button3D` or `HolographicButton` reads the context: if a movable ancestor exists, the child ignores its own `movable` prop and logs a dev warning.
- Default `dragType` is `FixedDistance` (OpenXR/PICO/Quest-appropriate).
- `HolographicSlate`'s grab handle is the title bar (inherited from `ViroSlate` in `@viro-external/core`).
