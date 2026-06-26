# Integrating `@viro-external/splat-pass` into a host app

This package ships TypeScript, GLSL shaders, and native C++ for a
Gaussian-splat render pass that hooks into ViroCore's `VROChoreographer`.
The Java/JNI bridge that surfaces it as `NativeModules.ViroSplatPass`
ships in `@reactvision/react-viro` v2.57+. The host app supplies the
`libsplat_pass.so` build glue.

## 1. Add the dep

```bash
npm install @viro-external/splat-pass
# or with file: deps inside a workspace
npm install file:../viro-external/packages/splat-pass
```

Peer deps assumed present in the host: `@reactvision/react-viro@2.57.0`,
`react-native-viro-mux`, `zustand@^5`, `react`, `react-native`.

## 2. Wire the CMakeLists

In `android/app/build.gradle` inside the `android { ... }` block:

```gradle
externalNativeBuild {
    cmake {
        path "$rootDir/../node_modules/@viro-external/splat-pass/native/CMakeLists.txt"
        version "3.22.1"
    }
}
```

And inside `defaultConfig { ... }`:

```gradle
externalNativeBuild {
    cmake {
        arguments  "-DANDROID_STL=c++_shared",
                   "-DVIROCORE_INCLUDE_DIR=$rootDir/../node_modules/@reactvision/react-viro/android/viro_renderer/include/ViroRenderer",
                   "-DVIROCORE_ANDROID_INCLUDE_DIR=$rootDir/../node_modules/@reactvision/react-viro/android/viro_renderer/include"
        abiFilters "arm64-v8a"
    }
}
```

> The two `-D` paths must resolve to the virocore C++ headers
> (`PersistentRef.h`, `VROChoreographer.h`, `VRORenderPass.h`). If you
> consume virocore as a prebuilt AAR drop, the headers won't be in the
> AAR — either vendor them under `android/app/src/main/cpp/include/viro/`
> or build virocore from source and point the dirs at its checkout.

## 3. Use it from JS

```tsx
import { registerSplatPass } from '@viro-external/splat-pass';

// Direct, no React hooks:
const handle = await registerSplatPass({
  source: { uri: 'file:///sdcard/Download/orb.spz', format: 'spz' },
  quality: { maxSplats: 1_000_000 },
});
// later
handle.release();
```

Or compose via `@viro-external/core/splat/ViroGaussianSplat`, which
register/release on mount/unmount automatically and falls back to the
legacy `ViroSplatRenderer` capability probe.

## 4. Verify on device

```bash
adb logcat -s ViroSplatPass Viro    # both tags
```

First-frame log lines you should see:
- `Viro: VROChoreographer custom post-opaque pass installed`
- `SplatPass: detected device profile = quest3` (or `mali` / `unknown`)
- `SplatPass: staged N splats` after a successful `registerPass` call.

## Source URI support

The Java fetcher handles `file://`, `content://`, `http://`, `https://`,
and bare paths (treated as files). The fetch happens on a worker thread;
the JNI `nativeAttach` blocks on the GL queue.

## Build flags

- `-fno-rtti` is NOT set — virocore needs RTTI for its
  `dynamic_pointer_cast` chain in the JNI shim.
- `-Wl,-z,max-page-size=16384` is set in `native/CMakeLists.txt` for
  Android 15+ Play Store policy (16KB-aligned ELF).
- `c++_shared` STL is required; matches virocore's NDK config.
