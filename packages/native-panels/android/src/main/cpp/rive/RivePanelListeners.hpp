//
//  RivePanelListeners.hpp — @viro-external/native-panels
//
//  State listeners of one RivePanel. VRORivePanel reports on its render
//  thread; listeners are JS callbacks, delivered with callAndForget.
//
//  The mutex guards only the map. emit() copies the listeners under it and
//  calls them after unlocking, so a listener that adds or removes listeners
//  cannot deadlock, and a removal during an emission may still receive that
//  one event.
//

#pragma once

#include <NitroNativePanels/ListenerSubscription.hpp>
#include <NitroNativePanels/RivePanelState.hpp>
#include <NitroModules/Callback.hpp>

#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <string>

namespace margelo::nitro::nativepanels {

class RivePanelListeners final : public std::enable_shared_from_this<RivePanelListeners> {
public:
  using Listener = Callback<void(RivePanelState, const std::string&)>;

  ListenerSubscription add(const Listener& listener);
  void emit(RivePanelState state, const std::string& detail);
  void clear();

private:
  void remove(uint64_t id);

  std::mutex _mutex;
  std::map<uint64_t, Listener> _listeners;
  uint64_t _nextId = 1;
};

} // namespace margelo::nitro::nativepanels
