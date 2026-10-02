# Viro External — Premium Spatial Toolkit

This workspace is now organized around a Nitro-free premium path.

## Recommended packages

- **@viro-external/premium** — one install/import surface
- **@viro-external/core** — movement, geometry, slates and spatial primitives
- **@viro-external/media** — URL/Mux source adapters plus flat, curved, 360 video and 360 imagery
- **@viro-external/ui** — draggable/resizable square, rounded and curved panels, headers, actions, scroll content and media panels

## Native renderer extensions

Heavy renderer features remain opt-in packages:

- @viro-external/render-passes
- @viro-external/splat-pass
- @viro-external/orb-pass
- @viro-external/specs
- @viro-external/webspatial

This keeps ordinary premium UI/media consumers from paying for native render-pass integrations they do not use.

## Legacy

`react-native-viro-mux` remains in the workspace only for older applications that still depend on its external-GPU-texture/Nitro bridge. New media and panel work must not depend on it.

`@viro-external/meta` is retained unchanged as the legacy compatibility umbrella so existing imports keep working. New code should use `@viro-external/premium`.

`@viro-external/pano` is now a compatibility entrypoint over the Nitro-free `SpatialPanorama` media primitive.

## Native/Eskiu direction

Memory-sensitive renderer plumbing belongs in ViroCore/Eskiu behind Viro's renderer ABI. React packages remain declarative composition and provider adapters; they should not introduce a second native media runtime simply to play video.
