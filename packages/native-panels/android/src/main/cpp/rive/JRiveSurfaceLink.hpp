//
//  JRiveSurfaceLink.hpp — @viro-external/native-panels
//
//  fbjni binding of the Kotlin class com.margelo.nitro.nativepanels.rive.RiveSurfaceLink.
//  registerNatives() runs in JNI_OnLoad, which also caches the class while
//  the app's class loader is current, so later calls from native threads find it.
//

#pragma once

#include <fbjni/fbjni.h>

#include <cstdint>

namespace margelo::nitro::nativepanels::rive {

struct JSurface : facebook::jni::JavaClass<JSurface> {
  static constexpr auto kJavaDescriptor = "Landroid/view/Surface;";
};

struct JRiveSurfaceLink : facebook::jni::JavaClass<JRiveSurfaceLink> {
  static constexpr auto kJavaDescriptor = "Lcom/margelo/nitro/nativepanels/rive/RiveSurfaceLink;";

  static bool isRegistryAvailable();
  static facebook::jni::local_ref<javaobject> subscribe(int32_t surfaceId, int64_t nativeHandle);
  void close();

  static void registerNatives();

private:
  static void nativeSurfaceProvided(facebook::jni::alias_ref<javaobject> self, jlong handle,
                                    facebook::jni::alias_ref<JSurface::javaobject> surface, jint width, jint height);
  static void nativeSurfaceRevoked(facebook::jni::alias_ref<javaobject> self, jlong handle);
};

} // namespace margelo::nitro::nativepanels::rive
