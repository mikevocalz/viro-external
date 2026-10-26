//
//  JRiveSurfaceLink.cpp — @viro-external/native-panels
//

#include "JRiveSurfaceLink.hpp"

#include "RiveSurfaceTarget.hpp"

namespace margelo::nitro::nativepanels::rive {

using namespace facebook;

bool JRiveSurfaceLink::isRegistryAvailable() {
  static const auto method = javaClassStatic()->getStaticMethod<jboolean()>("isRegistryAvailable");
  return method(javaClassStatic()) != JNI_FALSE;
}

jni::local_ref<JRiveSurfaceLink::javaobject> JRiveSurfaceLink::subscribe(int32_t surfaceId, int64_t nativeHandle) {
  static const auto method = javaClassStatic()->getStaticMethod<javaobject(jint, jlong)>("subscribe");
  return method(javaClassStatic(), static_cast<jint>(surfaceId), static_cast<jlong>(nativeHandle));
}

void JRiveSurfaceLink::close() {
  static const auto method = javaClassStatic()->getMethod<void()>("close");
  method(self());
}

void JRiveSurfaceLink::registerNatives() {
  javaClassStatic()->registerNatives({
      makeNativeMethod("nativeSurfaceProvided", JRiveSurfaceLink::nativeSurfaceProvided),
      makeNativeMethod("nativeSurfaceRevoked", JRiveSurfaceLink::nativeSurfaceRevoked),
  });
}

void JRiveSurfaceLink::nativeSurfaceProvided(jni::alias_ref<javaobject>, jlong handle,
                                             jni::alias_ref<JSurface::javaobject> surface, jint width, jint height) {
  if (handle == 0) return;
  reinterpret_cast<RiveSurfaceTarget*>(handle)->provide(jni::Environment::current(), surface.get(), width, height);
}

void JRiveSurfaceLink::nativeSurfaceRevoked(jni::alias_ref<javaobject>, jlong handle) {
  if (handle == 0) return;
  reinterpret_cast<RiveSurfaceTarget*>(handle)->revoke();
}

} // namespace margelo::nitro::nativepanels::rive
