# Component and package catalogue

[Handbook](README.md) · [Readiness matrix](CAPABILITIES.md)

## Spatial UI

| Public surface | Use it for | Notes |
| --- | --- | --- |
| `SpatialPanel` | Panel background, movement, scaling, header and actions | Square/rounded/curved scene geometry; see [layouts](LAYOUTS.md) |
| `PanelHeader`, `PanelButton`, `SpatialHitTarget` | Chrome and interaction affordances | Keep visible geometry and hit targets under the same carrier |
| `PanelText`, `PanelImage` | Viro-native panel content | Not arbitrary DOM or React Native views |
| `SpatialScrollView` | Explicit viewport/row virtualization and controls | Web wheel input needs a hit-testable descendant and updated bridge |
| `SpatialWorkspaceFrame`, `SpatialWorkspaceSlotNode` | Workspace origin or low-level slot carrier | Choose one transform owner |
| `SpatialMediaSurface`, `SpatialVideoPlayerPanel`, `VideoPlayerPanel`, `MuxSpatialPlayerPanel` | Media presentation and controls | Different component/controller responsibilities; see below |
| `QuickDrawSpatialSurface`, `QuickdrawSpatialPanel`, `MusePenInput` | Drawing presentation and normalized pen input | Preserve spelling/case; requires real drawing/pen integration |
| `Glasses*` exports | Wearable UI building blocks | Host still owns focus, keyboard and native services |

The exact public names live in [UI index.ts](../packages/ui/src/index.ts). Avoid promising APIs merely because a similarly named internal type file exists.

## Media: component versus controller

Use a declarative media component for a local scene-owned presentation. Use a long-lived `SpatialVideoPlayer` or `MuxSpatialPlayerController` when an application needs a shared playback session across views/panels. Bind views and controls to that single owner instead of creating one player for every panel render.

The Premium guide distinguishes `MuxSpatialPlayer` (component), `SpatialVideoPlayer` + `SpatialVideoPlayerView` (shared-state approach), `MuxSpatialPlayerController` (controller), and `SpatialVideoPlayerPanel` (controls). Treat playback state, surface mounting and native resource teardown as separate responsibilities. Confirm exact constructor/source options in the [media package](../packages/media) before writing application code.

Flat, curved and 360 presentation is not the same as 360/spatial audio, DRM support, or identical codecs on every target. This handbook makes no such guarantees. A Mux source adapter is not a requirement to install the legacy Nitro/Mux bridge.

The [WebRTC package](../packages/react-native-viro-webrtc) connects live tracks to the compatible fork's `ViroExternalVideo` API. Do not replace its missing exports with `any`, pretend upstream v3.0.1 has them, or interpret TypeScript success as a live-track native-device test.

## Drawing, pen and wearable UI

[QuickDraw](../packages/ui/doc/QuickDrawSpatialSurface.md) remains the editor/document authority. The spatial adapter must provide its real ESIKU-backed render target; the scene component is not a second drawing engine. Do not implement a screenshot/canvas replay loop to make an unimplemented native host look ready.

The [wearable UI guide](../packages/ui/doc/WearableUIKit.md) covers BackPlate/frame/button/control/layout equivalents exported as `Glasses*` components. `GlassesTextInput` exposes display and activation semantics; it does not create a working native keyboard. Native focus, text entry and accessibility still belong to the platform host.

## Platform and optional renderer packages

| Package directory | Responsibility / boundary |
| --- | --- |
| [meta-layout](../packages/meta-layout) | Meta workspace intent/resolution; connect the actual host wrappers |
| [pico-layout](../packages/pico-layout) | PICO layout planning and activity-container bridge boundary |
| [web-layout](../packages/web-layout), [webspatial](../packages/webspatial) | Web presentation adapters; distinct from the Viro web renderer |
| [spatial-runtime](../packages/spatial-runtime) | Compute/runtime boundaries and native memory ownership direction |
| [openxr](../packages/openxr), [viture](../packages/viture) | Capability/native transport boundaries; inspect concrete backend implementation |
| [meta-wearables](../packages/meta-wearables) | Wearable lifecycle/transport; not an immersive rendering guarantee |
| [specs](../packages/specs) | Specs/Lens runtime and build integration |
| [render-passes](../packages/render-passes), [splat-pass](../packages/splat-pass), [orb-pass](../packages/orb-pass) | Opt-in renderer extensions, not ordinary Premium UI dependencies |

Native memory-sensitive rendering belongs behind the Viro/ViroCore–Eskiu boundary. React composes declarative surfaces and providers. Keep Kinetrell as the application's animation layer; do not confuse a dependency policy with a shipped animation integration or claim that every package uses it internally.

## Migration map

| Existing dependency | Recommended direction |
| --- | --- |
| `@viro-external/meta` | Keep for legacy compatibility; adopt `@viro-external/premium` or focused packages for new work |
| `react-native-viro-mux` | Keep only when the old external-GPU-texture bridge is genuinely required; new media uses the provider-neutral media/UI path |
| `@viro-external/pano` | Compatibility entry point over the newer panorama primitive |
| Ad-hoc panel geometry/components | Prefer `SpatialPanel`, with explicit content/interaction ownership |

Migration requires testing actual playback, input and lifecycle behavior; matching component names are not behavioral proof.
