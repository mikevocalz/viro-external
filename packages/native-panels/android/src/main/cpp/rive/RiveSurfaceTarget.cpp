//
//  RiveSurfaceTarget.cpp — @viro-external/native-panels
//

#include "RiveSurfaceTarget.hpp"

#include "RivePanelListeners.hpp"
#include "RivePanelStateMapping.hpp"

#include <android/log.h>
#include <android/native_window_jni.h>

#include <utility>

namespace margelo::nitro::nativepanels::rive {

namespace {
constexpr const char* kTag = "NativePanelsRive";
}

RiveSurfaceTarget::RiveSurfaceTarget(std::weak_ptr<VRORivePanel> panel, std::weak_ptr<RivePanelListeners> listeners,
                                     int32_t widthPx, int32_t heightPx)
    : _panel(std::move(panel)), _listeners(std::move(listeners)), _widthPx(widthPx), _heightPx(heightPx) {}

void RiveSurfaceTarget::provide(JNIEnv* env, jobject surface, int32_t widthPx, int32_t heightPx) {
  const auto panel = _panel.lock();
  if (panel == nullptr) return;
  if (widthPx != _widthPx || heightPx != _heightPx) {
    if (!panel->resize(widthPx, heightPx)) {
      report(panel, "Viro provided a Surface size the panel rejected");
      return;
    }
    _widthPx = widthPx;
    _heightPx = heightPx;
  }
  ANativeWindow* window = ANativeWindow_fromSurface(env, surface);
  if (window == nullptr) {
    report(panel, "ANativeWindow_fromSurface returned null for the provided Surface");
    return;
  }
  const bool attached = panel->attachSurface(window);
  ANativeWindow_release(window);
  if (!attached) report(panel, "The panel rejected the provided Surface");
}

void RiveSurfaceTarget::revoke() {
  if (const auto panel = _panel.lock()) panel->surfaceLost();
}

void RiveSurfaceTarget::report(const std::shared_ptr<VRORivePanel>& panel, const char* detail) {
  __android_log_print(ANDROID_LOG_ERROR, kTag, "%s", detail);
  if (const auto listeners = _listeners.lock()) listeners->emit(toRivePanelState(panel->getState()), detail);
}

} // namespace margelo::nitro::nativepanels::rive
