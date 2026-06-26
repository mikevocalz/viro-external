# @viro-external/meta

One install + one import surface over the `@viro-external/*` family.

```sh
pnpm add @viro-external/meta
```

```ts
// broad import
import {
  ViroCylinderSurface, ViroSlate, ViroGaussianSplat,
  HolographicSlate, HolographicButton, StackPanel3D, CylinderPanel,
  Slider3D, TouchHolographicMenu, SceneZone,
  MovableNode, ViroMuxVideo, ViroMuxSurface,
} from "@viro-external/meta";

// narrow imports (better tree-shaking)
import { ViroCylinderSurface } from "@viro-external/meta/core";
import { HolographicSlate } from "@viro-external/meta/gui";
import { MovableNode } from "@viro-external/meta/bridge";
```

See `doc/Install.md`, `doc/Imports.md`, `doc/Compatibility.md`.
