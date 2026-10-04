# react-native-viro-mux — legacy compatibility

This package is retained for applications that still depend on the old Nitro
external-texture bridge.

**New code should use `@viro-external/media` and `@viro-external/ui`.**

The new premium path supports ordinary 2D, curved 2D, immersive 360 video and
Mux playback IDs without requiring Nitro. Mux is treated as a media source
provider, not as the native player architecture.

The remaining reason to keep this package is its legacy external-GPU-texture
bridge. That capability is intended to move into ViroCore/Eskiu so it can be a
renderer feature rather than a separate React Native native-runtime dependency.
