# Viro External

### Spatial workspaces, interactive panels, native media, and renderer integrations for Viro.

Compose a three-panel workspace, add a curved inspector, connect a Rive artboard to a native host, or carry a video controller between views. Viro External separates reusable React composition from platform-owned windows, input, rendering, and GPU resources.

**[Start here](docs/GETTING_STARTED.md) · [Layouts](docs/LAYOUTS.md) · [Rive](docs/RIVE.md) · [Feature status](docs/CAPABILITIES.md) · [Full handbook](docs/README.md)**

> **Readiness matters.** An exported component, a platform adapter, and a verified native renderer are different deliverables. Scene panels exist; independent OpenXR compositor panels remain a separate implementation track. Rive needs an injected native host. Check the [capability matrix](docs/CAPABILITIES.md) before choosing an integration.

## What can I build?

| Build | Start with | Important boundary |
| --- | --- | --- |
| A left/center/right XR workspace | `SpatialWorkspaceFrame` + `SpatialPanel` | World-space Viro scene geometry, not OS windows |
| A curved, draggable inspector | `curved`, `snapTo`, `onSnap`, panel header actions | Curvature changes the background mesh; it does not bend arbitrary children |
| List/detail/assistant surfaces across devices | `WorkspaceDefinition` + adapter resolution | The app owns selection and navigation; native window promotion is capability-gated |
| An interactive Rive surface | `createRiveSpatialSurface` + `ViroCoreRiveSpatialAdapter` | The application supplies a real native host; not a nested React Native `RiveView` |
| Flat, curved, or 360 media | `@viro-external/media` and player controllers | Provider adapters do not replace Viro's native media/rendering path |
| Spatial drawing and pen input | QuickDraw surface/panel contracts + `MusePenInput` | Concrete QuickDraw renderer integration is still required |
| Wearable UI and platform integration | `Glasses*` UI, XR contracts, platform packages | Display, focus, camera, and session capabilities differ per backend |

## Choose your entry point

| Package | Responsibility |
| --- | --- |
| **[@viro-external/premium](packages/premium/README.md)** | Convenient import surface for core, media, and UI |
| [@viro-external/ui](packages/ui/README.md) | Scene panels, headers, actions, scrolling, workspace placement, and host adapters |
| [@viro-external/core](packages/viro-external-core) | Movement, geometry, slates, and spatial primitives |
| [@viro-external/media](packages/media) | Provider-neutral media, Mux adapters, and persistent player controllers |
| [@viro-external/xr-contract](packages/xr-platform-contract/README.md) | Shared capability, interaction, workspace, and surface contracts; no renderer |

The premium runtime dependency graph deliberately excludes legacy `react-native-viro-mux` and Nitro Modules. Native render-pass packages remain opt-in. That does not imply every optional native integration has the same dependencies or readiness.

## First workspace

After [setting up the compatible Viro fork](docs/GETTING_STARTED.md), place this component **inside an existing Viro scene**. `origin` must be a settled pose from your host, not a live head-tracking subscription. Increment `epoch` only for deliberate recentering.

```tsx
import React from "react";
import {
  PanelText, SpatialPanel, SpatialWorkspaceFrame,
  type SpatialWorkspaceOrigin,
} from "@viro-external/ui";

export function FirstWorkspace({ origin, epoch }: {
  origin: SpatialWorkspaceOrigin;
  epoch: number;
}) {
  return (
    <SpatialWorkspaceFrame key={epoch} {...origin}>
      <SpatialPanel title="Discover" curved snapTo="left" showCloseAction={false}>
        <PanelText text="Choose something to explore" width={1.3} height={0.6} />
      </SpatialPanel>
      <SpatialPanel title="Workspace" snapTo="center" showCloseAction={false}>
        <PanelText text="Your primary task stays here" width={1.3} height={0.6} />
      </SpatialPanel>
      <SpatialPanel title="Inspector" curved curvature={0.24} snapTo="right">
        <PanelText text="Context without leaving your task" width={1.3} height={0.6} />
      </SpatialPanel>
    </SpatialWorkspaceFrame>
  );
}
```

This is scene content, not a complete Expo application or a claim of headset validation. The [selection-driven example](docs/examples/SpatialWorkspaceExample.tsx) also connects inspector close behavior to app-owned state. Never wrap a snapping panel in a `SpatialWorkspaceSlotNode`; both would own its placement.

## Learn by task

| I need to… | Guide |
| --- | --- |
| Install, choose a Viro revision, or diagnose missing exports | [Getting started and troubleshooting](docs/GETTING_STARTED.md) |
| Understand scene panels versus system windows | [Spatial layouts and ownership](docs/LAYOUTS.md) |
| Integrate Rive artboards, state machines, pointers, and disposal | [Rive native integration](docs/RIVE.md) |
| Find media, wearable UI, drawing, or optional renderer packages | [Component and package catalogue](docs/MEDIA_AND_COMPONENTS.md) |
| Check what is implemented versus host-dependent or type-only | [Capability and verification matrix](docs/CAPABILITIES.md) |
| Run the examples and documentation checks | [Examples](docs/examples/README.md) |

## Architecture in one view

```text
App-owned state and semantic workspace
  ├── Flat/mobile/web UI: the application's responsive layout
  ├── Viro scene UI: SpatialPanel + workspace origin + normalized input
  └── Platform resolvers: Meta / PICO / web presentation intent
           ↓ actual capability and lifecycle checks
Native platform host / Viro renderer / ViroCore–Eskiu boundary
           ↓
Rendering, media, input ownership, native surfaces and GPU resources
```

A resolver plans presentation. A host presents it. A runtime capability report and device evidence establish support. Installing an adapter alone does not create multiple system windows.

## Development and verification

The repository pins pnpm and uses a sibling `../viro` override. Follow the [source-workspace setup](docs/GETTING_STARTED.md), not a blind npm install of an assumed published version.

```sh
pnpm typecheck
pnpm test:rive-contract
pnpm test:workspace-surface
pnpm check:metro
node scripts/check-docs.mjs
node --experimental-strip-types --test docs/examples/workspace-contract.test.mjs
```

CI access and binding drift are handled separately in [PR #60](https://github.com/mikevocalz/viro-external/pull/60). A passing portable check is not a native release build or a device test. This documentation PR does not merge that CI change or configure credentials.

## Compatibility and migration

Use `@viro-external/premium` or focused packages for new code. `@viro-external/meta` remains the legacy compatibility umbrella; `@viro-external/pano` is a compatibility entry point over the newer panorama primitive. Keep `react-native-viro-mux` only for applications that still require its legacy external-texture bridge. The [catalogue](docs/MEDIA_AND_COMPONENTS.md) explains the package boundaries.

## Contributing

New features need a public export, a focused guide/example, a capability-matrix update, and evidence appropriate to the claim. Record the exact commit, platform, build mode, and test command; keep mocks, typechecks, browser tests, and headset runs distinct. Put native memory-sensitive ownership in the renderer boundary, not in per-frame JavaScript screenshot or canvas loops. Preserve application-owned Zustand state and the project's Kinetrell animation policy; do not add a competing animation stack as part of documentation work.
