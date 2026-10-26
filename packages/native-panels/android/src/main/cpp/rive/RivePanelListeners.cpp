//
//  RivePanelListeners.cpp — @viro-external/native-panels
//

#include "RivePanelListeners.hpp"

namespace margelo::nitro::nativepanels {

ListenerSubscription RivePanelListeners::add(const Listener& listener) {
  const uint64_t id = _set.add(listener);
  std::weak_ptr<RivePanelListeners> weak = weak_from_this();
  return ListenerSubscription(Callback<void()>::make([weak, id]() {
    if (auto self = weak.lock()) self->_set.remove(id);
  }));
}

void RivePanelListeners::emit(RivePanelState state, const std::string& detail) {
  _set.emit(state, detail);
}

void RivePanelListeners::clear() {
  _set.clear();
}

} // namespace margelo::nitro::nativepanels
