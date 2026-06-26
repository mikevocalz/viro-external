# Movability — drag/pinch contract

`MovableProps` + `MovableNode` are defined and **frozen** in `src/contract.ts`. Every downstream package composes `MovableNode`; no one re-wires `onDrag`.

## Verified Viro 2.56.0 surface

From `components/Studio/domain/viroNodeFactory.tsx`:

```ts
dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";
dragPlane?: { planePoint: [number,number,number]; planeNormal: [number,number,number]; maxDistance: number };
```

From `components/ViroBase.tsx`:

- `_onDrag = (event: NativeSyntheticEvent<ViroDragEvent>) => this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source)`
- `_onPinch = (event: NativeSyntheticEvent<ViroPinchEvent>) => this.props.onPinch(...)`

So `onDrag` receives `(worldPos: [number,number,number], source: number)` from native. `onPinch` reports `pinchState` and `scaleFactor`.

## VR (OpenXR / PICO / Quest) vs AR availability

| Mode                  | AR (ARKit/ARCore) | VR (OpenXR / PICO / Quest) | Notes |
| --------------------- | ----------------- | -------------------------- | ----- |
| `FixedDistance`       | ✅                | ✅                          | Default. Drags along ray at fixed distance from camera. |
| `FixedDistanceOrigin` | ✅                | ✅                          | Verified present in 2.56.0; controller-ray friendly. |
| `FixedToWorld`        | ✅                | ❌                          | Documented AR-only — requires AR hit-test against world. |
| `FixedToPlane`        | ✅                | ✅                          | Works with a synthetic plane in VR (e.g. floor at y=0). |
| `onHover`             | ✅                | ❌                          | AR-only per Viro docs. |
| Controller / hand ray | n/a               | ✅                          | Primary input on PICO/Quest. |

The default in `config/defaults.json` is `FixedDistance` because it works in both worlds.

## `axisLock` — our addition

Viro cannot lock to a single axis natively. `FixedToPlane` locks to a *plane*, not a *line*. We implement axis lock by re-clamping the locked components inside `MovableNode`'s `onDrag` handler, against the pre-drag world position captured on `onDragStart`.

```ts
// inside MovableNode
const start = useRef<[number,number,number] | null>(null);
const handleDrag = (worldPos: [number,number,number]) => {
  const s = start.current ?? worldPos;
  const clamped: [number,number,number] = [
    axisLock?.includes('x') ? s[0] : worldPos[0],
    axisLock?.includes('y') ? s[1] : worldPos[1],
    axisLock?.includes('z') ? s[2] : worldPos[2],
  ];
  props.onMove?.(clamped);
};
```

## Pinch-to-scale

When `pinchToScale` is `true`, `MovableNode` writes the pinch's `scaleFactor` into the wrapper `ViroNode`'s `scale` prop on pinch end (`pinchState === 3` per Viro convention — confirm in source before committing). On `pinchState === 1` (start) it snapshots the current scale; on `pinchState === 2` (change) it multiplies snapshot × factor; on end it commits.
