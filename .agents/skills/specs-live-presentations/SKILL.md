---
name: specs-live-presentations
description: Implement and review portable spatial screens and the Lens Studio presentation host for Snap SPECS 27.
---
# SPECS 27 live presentations

1. Read `packages/specs/README.md`, `doc/LivePresentation.md`, the
   XR contract and current `ViroSpecs*Host` files before changing code.
2. Use Snap's SPECS 27 CLAD workflow. The historical
   `specs-devs/agentic-tools` skills are reference material only when
   compatible with 5.22+. Follow `specs-devs/samples/Navigation Kit`,
   `Custom Locations`, `Specs Mobile Kit` and `packages/SpecsNavigationKit`.
3. Render ordinary app data through JSON-safe portable nodes; Lens Studio,
   UI Kit and SIK exclusively own on-device SceneObjects and input.
4. Maintain `[x,y,z,w]` across the portable boundary; reorder only at the
   Lens `quat(w,x,y,z)` constructor.
5. Validate the complete scene and all action target IDs before destroying
   any existing frame. Retire SIK listeners and collision targets first.
6. Follow Snap spatial design for glanceable walking UI, comfortable binocular
   overlap, readable contrast and hand interactions; never put a full desktop
   SplitView in the wearer's field of view.
7. Run `pnpm --filter @viro-external/xr-contract build`, Specs build,
   `specs:validate-lens`, `specs:test-presentation` and CLAD LEAF Preview.
   Record simulator and physical hardware results separately.
8. Keep Viro native, web and Specs renderers separate; do not silently turn
   unsupported video, Rive or native textures into screenshots.

Mandatory cross-project skill references:
`expo/skills`, `mattpocock/skills`, `Argent/agent-device`,
`coreyhaines31/marketingskills`, `pbakaus/impeccable`,
`petergyang/no-ai-slop`, and this repo's
`mikevocalz-foldable-layouts`. Apply each where pertinent.
