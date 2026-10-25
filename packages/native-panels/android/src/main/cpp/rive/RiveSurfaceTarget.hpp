//
//  RiveSurfaceTarget.hpp — @viro-external/native-panels
//
//  What the Kotlin RiveSurfaceLink calls into when Viro provides or revokes
//  the Surface. Called on whichever thread CanvasSurfaces delivers on, one
//  call at a time (the Kotlin side serialises them under its lock).
//

#pragma once

#include "../vendor/virocore/VRORivePanel.h"

#include <jni.h>

#include <cstdint>
#include <memory>

namespace margelo::nitro::nativepanels {
class RivePanelListeners;
}

namespace margelo::nitro::nativepanels::rive {

class RiveSurfaceTarget final {
public:
  RiveSurfaceTarget(std::weak_ptr<VRORivePanel> panel, std::weak_ptr<RivePanelListeners> listeners, int32_t widthPx,
                    int32_t heightPx);

  // Resizes the panel if Viro allocated another size, then attaches the
  // window. The panel takes its own window reference, so ours is released
  // before returning.
  void provide(JNIEnv* env, jobject surface, int32_t widthPx, int32_t heightPx);

  // Returns after the panel has destroyed its EGL surface and dropped its
  // window reference, so Viro may release the Surface.
  void revoke();

private:
  void report(const std::shared_ptr<VRORivePanel>& panel, const char* detail);

  const std::weak_ptr<VRORivePanel> _panel;
  const std::weak_ptr<RivePanelListeners> _listeners;
  int32_t _widthPx;
  int32_t _heightPx;
};

} // namespace margelo::nitro::nativepanels::rive
