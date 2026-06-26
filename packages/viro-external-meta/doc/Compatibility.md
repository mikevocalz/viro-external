# Compatibility

## Verified stack (verified on npm at scaffold time)

| Component                  | Version       |
| -------------------------- | ------------- |
| `@reactvision/react-viro`  | `2.56.0`      |
| `react-native`             | `0.86.0`      |
| `expo`                     | `56.0.12`     |
| `react-native-nitro-modules`| `0.35.9`     |

Re-verify with `npm view <pkg> version` before bumping. RN 0.86 + react-viro 2.56.0 requires an RN-version override in the consumer app — `react-viro` declares a peer of `react-native@">=0.81.0 <0.84.0"` which is older; this is bleeding-edge usage, acknowledged.

## XR target notes (honest, not aspirational)

| Target                     | Status |
| -------------------------- | ------ |
| **Meta Quest 3 / Pro**     | Primary VR target. Full 3D + 4D splats; all GUI controls; OpenXR drag modes (`FixedDistance`, `FixedDistanceOrigin`, `FixedToPlane`). |
| **Meta Quest 2**           | Static 3D splats only (4D temporal eval disabled by device profile). Full GUI. |
| **Horizon OS (generic)**   | Like Quest 2. |
| **PICO (4 / 4U / Neo)**    | Same as Quest 2 — relies on the `mikevocalz/virocore` `pico-support` branch and the 16KB ELF alignment fix. |
| **ARKit (iPhone/iPad)**    | Static 3D splats only. `FixedToWorld` and `onHover` are AR-only. |
| **ARCore (Android)**       | Same as ARKit. |
| **visionOS (Apple Vision Pro)** | **Separate native driver required** — ReactVision has not (publicly) shipped a visionOS Viro driver; tracking. Not supported here without that. |

## Drag-mode matrix (from `react-native-viro-mux/doc/Movability.md`)

| Mode                  | AR  | VR/OpenXR | Notes |
| --------------------- | --- | --------- | ----- |
| `FixedDistance`       | ✅  | ✅         | Default. |
| `FixedDistanceOrigin` | ✅  | ✅         | |
| `FixedToWorld`        | ✅  | ❌         | AR-only. |
| `FixedToPlane`        | ✅  | ✅         | Works with synthetic plane in VR. |
| `onHover`             | ✅  | ❌         | AR-only. |

## 4D Gaussian-splat targets

Per the device-profile table in `@viro-external/core/config/defaults.json`, **4D temporal evaluation is upper-tier-only** (Quest 3 / Quest Pro). Quest 2 / Horizon OS generic / ARCore / ARKit are static-3D-only. The component reports an honest error via `onError` when a 4D source is requested on a static-only device.
