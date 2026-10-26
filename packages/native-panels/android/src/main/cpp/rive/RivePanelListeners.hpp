//
//  RivePanelListeners.hpp — @viro-external/native-panels
//
//  State listeners of one RivePanel. VRORivePanel reports on its render
//  thread; listeners are JS callbacks, delivered with callAndForget.
//
//  The panel starts loading before JS can subscribe, so a state reported in
//  that window (a load error, for example) would otherwise be lost. Each
//  new listener therefore receives the last (state, detail) once when it is
//  added, then every later report in order. ReplayingListenerSet holds the
//  locking rules.
//

#pragma once

#include "ReplayingListenerSet.hpp"

#include <NitroNativePanels/ListenerSubscription.hpp>
#include <NitroNativePanels/RivePanelState.hpp>
#include <NitroModules/Callback.hpp>

#include <cstdint>
#include <memory>
#include <string>

namespace margelo::nitro::nativepanels {

class RivePanelListeners final : public std::enable_shared_from_this<RivePanelListeners> {
public:
  using Listener = Callback<void(RivePanelState, const std::string&)>;

  ListenerSubscription add(const Listener& listener);
  void emit(RivePanelState state, const std::string& detail);
  void clear();

private:
  rive::ReplayingListenerSet<Listener, RivePanelState, std::string> _set;
};

} // namespace margelo::nitro::nativepanels
