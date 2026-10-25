# Viro External handbook

[Repository home](../README.md)

## Start with a working mental model

Read [getting started](GETTING_STARTED.md), then [layouts](LAYOUTS.md). Use the [capability matrix](CAPABILITIES.md) to distinguish implemented JavaScript composition from native integration obligations. The documents describe the source baseline `2331527d50ffda0a8882c6fb832b10895c7c39f4`; they do not certify every platform.

| Topic | Guide | Source of truth |
| --- | --- | --- |
| Installation and dependencies | [Getting started](GETTING_STARTED.md) | [Workspace override](../pnpm-workspace.yaml), package manifests |
| Panels and workspace ownership | [Layouts](LAYOUTS.md) | [UI exports](../packages/ui/src/index.ts), [workspace contract](../packages/xr-platform-contract/src/workspaceSurface.ts) |
| Rive native-host lifecycle | [Rive](RIVE.md) | [Adapter](../packages/ui/src/RiveNativeHost.ts), [contract](../packages/xr-platform-contract/src/rive.ts) |
| Media, drawing, wearables, and platform packages | [Catalogue](MEDIA_AND_COMPONENTS.md) | Package sources and package-level guides |
| Implementation and verification limits | [Capabilities](CAPABILITIES.md) | [Compositor inventory](PANELS_STATUS.md) |
| Integration examples | [Examples](examples/README.md) | Source-backed examples and lifecycle tests |

## Native whiteboard, native Rive and rounded panels

Work from [ADR 0001](adr/0001-native-whiteboard-rive-panels.md). Both native producers sit behind flags that default off, and neither has run on a headset.

| Topic | Guide |
| --- | --- |
| Adopting the native QuickDraw board (`nativeBoard`) | [Native whiteboard](guides/native-whiteboard.md) |
| Adopting ViroCore's Rive producer (`nativeRive`) | [Native Rive panels](guides/native-rive-panels.md) |
| Corner radii, angle-locked tokens and hit testing | [Rounded panels](guides/rounded-panels.md) |
| Exported TypeScript with happy, unavailable and error call sites | [API reference](API_WHITEBOARD_RIVE_PANELS.md) |
| Measured sizes, budgets and the measurement plan | [Performance](PERFORMANCE.md) |
| Quest 3 and PICO 4 Ultra procedure and results | [Device validation](DEVICE_VALIDATION.md) |

## Deeper existing references

These references are retained rather than replaced. Historical PR links and platform assumptions in older notes may reflect when they were written; use the capability matrix and actual source for the documented baseline.

| Reference | Purpose |
| --- | --- |
| [UI package guide](../packages/ui/README.md) | Detailed panel props, interaction rules, and platform host examples |
| [Spatial workspace contract](../packages/xr-platform-contract/doc/SpatialWorkspace.md) | Legacy semantic roles, newer workspace definitions, capacity, focus, and lifecycle |
| [Native Rive host](../packages/ui/doc/RiveNativeHost.md) | Native implementation responsibilities |
| [Rive surface](../packages/ui/doc/RiveSpatialSurface.md) | Surface creation and pointer contract |
| [QuickDraw boundary](../packages/ui/doc/QuickDrawSpatialSurface.md) | Concrete native adapter requirement |
| [Wearable UIKit](../packages/ui/doc/WearableUIKit.md) | Portable `Glasses*` components and host services |
| [Compositor API proposal](SPATIAL_PANELS_API.md) | Next-stage design; not an exported runtime implementation |
| [Performance tracing](performance/tracesift.md) | Existing profiling workflow |

## Documentation checks

`node scripts/check-docs.mjs` checks local link targets in the handbook and that the named UI APIs used by the examples remain in the UI export surface. It does not check external URLs, native compatibility, every Markdown anchor, or full TypeScript semantics. The examples' contract tests exercise the actual source validator and lifecycle logic without a renderer. Run the complete application typecheck and device tests separately.
