//
//  RiveSurfaceLink.cpp — @viro-external/native-panels
//

#include "RiveSurfaceLink.hpp"

#include <android/log.h>

#include <exception>
#include <stdexcept>
#include <utility>

namespace margelo::nitro::nativepanels::rive {

using namespace facebook;

RiveSurfaceLink::RiveSurfaceLink(int32_t surfaceId, std::unique_ptr<RiveSurfaceTarget> target)
    : _target(std::move(target)) {
  const auto handle = reinterpret_cast<int64_t>(_target.get());
  // Attaches this thread to the JVM if needed. The class itself was cached in
  // JNI_OnLoad, so the lookup does not depend on this thread's class loader.
  jni::ThreadScope scope;
  if (!JRiveSurfaceLink::isRegistryAvailable()) {
    throw std::runtime_error("This Viro build has no com.viromedia.bridge.canvas.CanvasSurfaces registry; "
                             "update @reactvision/react-viro");
  }
  _java = jni::make_global(JRiveSurfaceLink::subscribe(surfaceId, handle));
}

RiveSurfaceLink::~RiveSurfaceLink() {
  try {
    close();
  } catch (const std::exception& error) {
    __android_log_print(ANDROID_LOG_ERROR, "NativePanelsRive", "Closing the Surface subscription failed: %s",
                        error.what());
  }
}

void RiveSurfaceLink::close() {
  if (_java) {
    jni::ThreadScope scope;
    // If this throws, the target is deliberately kept (leaked) rather than
    // freed while Kotlin may still call into it.
    _java->close();
    _java.reset();
  }
  // Safe only now: the Kotlin side no longer holds or uses the handle.
  _target.reset();
}

} // namespace margelo::nitro::nativepanels::rive
