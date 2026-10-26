//
//  RiveSurfaceLink.cpp — @viro-external/native-panels
//

#include "RiveSurfaceLink.hpp"

#include <android/log.h>

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
  close();
}

void RiveSurfaceLink::close() noexcept {
  if (_java) {
    try {
      jni::ThreadScope scope;
      try {
        _java->close();
      } catch (const std::exception& error) {
        leakTarget(error.what());
      }
      _java.reset();
    } catch (const std::exception& error) {
      // Attaching the thread failed, so Kotlin was not told to stop.
      leakTarget(error.what());
    }
  }
  // Reached with a target only when the Kotlin side no longer holds or uses
  // the handle.
  _target.reset();
}

void RiveSurfaceLink::leakTarget(const char* reason) noexcept {
  // Kotlin may still hold the handle and call into the target, so freeing
  // it here, or letting the member destructor free it, would be a
  // use-after-free. The leak is the target and the panel it keeps alive.
  __android_log_print(ANDROID_LOG_ERROR, "NativePanelsRive",
                      "Closing the Surface subscription failed; leaking its target: %s", reason);
  (void)_target.release();
}

} // namespace margelo::nitro::nativepanels::rive
