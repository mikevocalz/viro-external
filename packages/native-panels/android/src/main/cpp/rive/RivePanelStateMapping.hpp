//
//  RivePanelStateMapping.hpp — @viro-external/native-panels
//

#pragma once

#include "../vendor/virocore/VRORivePanel.h"

#include <NitroNativePanels/RivePanelState.hpp>

namespace margelo::nitro::nativepanels::rive {

inline RivePanelState toRivePanelState(VRORivePanelState state) {
  switch (state) {
    case VRORivePanelState::Initializing: return RivePanelState::INITIALIZING;
    case VRORivePanelState::WaitingForSurface: return RivePanelState::WAITING_FOR_SURFACE;
    case VRORivePanelState::Active: return RivePanelState::ACTIVE;
    case VRORivePanelState::Suspended: return RivePanelState::SUSPENDED;
    case VRORivePanelState::Lost: return RivePanelState::LOST;
    case VRORivePanelState::Disposed: return RivePanelState::DISPOSED;
  }
  return RivePanelState::LOST;
}

} // namespace margelo::nitro::nativepanels::rive
