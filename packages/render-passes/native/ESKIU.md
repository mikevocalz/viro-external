# Eskiu native backend

This directory contains the first Eskiu-native building block for the spatial
media/rendering stack.

The goal is intentionally narrow: move hot, deterministic spatial math out of
C++ without moving ownership of the external GPU texture or playback state.

The ABI is C-shaped and scalar-only. That keeps the boundary stable across
Android/iOS/native toolchains and avoids exposing Eskiu memory layouts to C++.

## Build

The backend is opt-in until the consuming app/toolchain has eskiuc installed:

  cmake -DVIRO_EXTERNAL_ENABLE_ESKIU=ON ...

The CMake build locates eskiuc, compiles spatial_media_math.esk to an object,
archives it, and links that archive into the render-pass shared library.

The default remains OFF so existing consumers are unchanged.

## Migration target

The next native migrations should be deterministic render-path work such as:

- curved-media arc/radius calculations
- radial layer/depth calculations
- interpolation/smoothing used by animated spatial controls
- bounded frame/presentation metrics
- Rive spatial-surface math (`vx_rive_*`): drag length/clamp/axis filtering,
  content-fit scaling and centering, and pointer-hit → surface UV. These are
  the scalar equivalents of the TS helpers in `packages/ui/src/RiveNativeHost.ts`;
  the native host calls them once it exists, while the TS adapter stays the
  portable fallback.

Do not move React state, Viro node ownership, native player lifecycle, or
external-texture ownership into Eskiu. Those remain at their existing boundaries.
