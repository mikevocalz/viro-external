//
//  RivePanelListeners.cpp — @viro-external/native-panels
//

#include "RivePanelListeners.hpp"

#include <vector>

namespace margelo::nitro::nativepanels {

ListenerSubscription RivePanelListeners::add(const Listener& listener) {
  uint64_t id = 0;
  {
    std::lock_guard lock(_mutex);
    id = _nextId++;
    _listeners.emplace(id, listener);
  }
  std::weak_ptr<RivePanelListeners> weak = weak_from_this();
  return ListenerSubscription(Callback<void()>::make([weak, id]() {
    if (auto self = weak.lock()) self->remove(id);
  }));
}

void RivePanelListeners::emit(RivePanelState state, const std::string& detail) {
  std::vector<Listener> snapshot;
  {
    std::lock_guard lock(_mutex);
    snapshot.reserve(_listeners.size());
    for (const auto& entry : _listeners) snapshot.push_back(entry.second);
  }
  for (const auto& listener : snapshot) listener.callAndForget(state, detail);
}

void RivePanelListeners::clear() {
  std::lock_guard lock(_mutex);
  _listeners.clear();
}

void RivePanelListeners::remove(uint64_t id) {
  std::lock_guard lock(_mutex);
  _listeners.erase(id);
}

} // namespace margelo::nitro::nativepanels
