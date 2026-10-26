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

## Nitro V1

The bridge runs on Nitro Modules V1 alpha (`1.0.0-alpha.nightly.100.g107f6fc66597`,
dist-tag `alpha-nightly`), Android only. Install the matching runtime in the app:

```sh
npm install react-native-nitro-modules@1.0.0-alpha.nightly.100.g107f6fc66597 nitro-core@1.0.0-alpha.nightly.100.g107f6fc66597
```

Both are optional peers, so the app's copy is the one that loads. V1 needs
React Native 0.88+ with the New Architecture. The generated JS runtime ships as
`.cjs`: Expo's Metro config already lists `cjs` in `resolver.sourceExts`; a
bare `@react-native/metro-config` app must add it. JS calls stay the same
(`registerExternalTexture`, `isExternalTextureReady`, ...); see
`doc/Native-Android.md` for the spec, Kotlin and build-file layout.
