# @viro-external/premium

The opinionated premium install surface for the Viro external ecosystem.

It intentionally does **not** depend on the legacy `react-native-viro-mux` package or Nitro Modules.

## Includes

- `@viro-external/core` — geometry, movement, slates and splat composition
- `@viro-external/media` — provider-neutral flat, curved and 360 video
- `@viro-external/ui` — draggable/resizable spatial panels, headers, actions, scrolling and media panels

## Import styles

    import {
      SpatialPanel,
      SpatialVideo,
      VideoPlayerPanel
    } from "@viro-external/premium";

or use subpaths:

    import { SpatialVideo } from "@viro-external/premium/media";
    import { SpatialPanel } from "@viro-external/premium/ui";

Native render-pass packages remain separate so applications only pay for the heavy renderer extensions they actually install.


## Player architecture

`@viro-external/premium` exposes both declarative media components and long-lived
controllers:

- `MuxSpatialPlayer` — simple Mux-aware spatial component with poster/status API.
- `SpatialVideoPlayer` + `SpatialVideoPlayerView` — provider-neutral shared state.
- `MuxSpatialPlayerController` — long-lived Mux-aware controller.
- `SpatialVideoPlayerPanel` — premium controls bound to one controller.
