//
//  ReplayingListenerSet.hpp — @viro-external/native-panels
//
//  A listener set that remembers the last emitted value. A listener added
//  after an emission receives that value once, at add(), and then every later
//  emission, in emission order. No Nitro dependency; tested on the host.
//
//  Listener is any copyable type with `callAndForget(const Args&...)`, such
//  as a Nitro Callback.
//
//  Two locks:
//  - _mutex guards the map, the id counter and the last value. It is never
//    held while a listener runs, so a listener may add or remove listeners.
//  - _orderMutex is held across one whole emission and across the replay in
//    add(). Without it a replay of an older value could reach a new listener
//    after a newer emission had already reached it. It is recursive so a
//    listener that adds another listener from inside its own call does not
//    deadlock on its own thread. A JS Callback only enqueues work on the JS
//    thread, so the hold is short; a native listener must not block on a
//    thread that may be inside add() or emit().
//

#pragma once

#include <cstdint>
#include <map>
#include <mutex>
#include <optional>
#include <tuple>
#include <utility>
#include <vector>

namespace margelo::nitro::nativepanels::rive {

template <typename Listener, typename... Args>
class ReplayingListenerSet final {
public:
  // Registers the listener and, when a value was emitted before, delivers
  // the last one to it. Returns the id for remove().
  uint64_t add(const Listener& listener) {
    std::lock_guard order(_orderMutex);
    uint64_t id = 0;
    std::optional<std::tuple<Args...>> last;
    {
      std::lock_guard lock(_mutex);
      id = _nextId++;
      _listeners.emplace(id, listener);
      last = _last;
    }
    if (last.has_value()) {
      std::apply([&listener](const Args&... args) { listener.callAndForget(args...); }, *last);
    }
    return id;
  }

  // Stores the value as the last one and delivers it to every listener
  // registered when the emission starts. A listener removed during the
  // emission may still receive this one value.
  void emit(const Args&... args) {
    std::lock_guard order(_orderMutex);
    std::vector<Listener> snapshot;
    {
      std::lock_guard lock(_mutex);
      _last.emplace(args...);
      snapshot.reserve(_listeners.size());
      for (const auto& entry : _listeners) snapshot.push_back(entry.second);
    }
    for (const auto& listener : snapshot) listener.callAndForget(args...);
  }

  void remove(uint64_t id) {
    std::lock_guard lock(_mutex);
    _listeners.erase(id);
  }

  // Drops every listener. The last value is kept, so a listener added later
  // still learns the final state.
  void clear() {
    std::lock_guard lock(_mutex);
    _listeners.clear();
  }

private:
  std::recursive_mutex _orderMutex;
  std::mutex _mutex;
  std::map<uint64_t, Listener> _listeners;
  std::optional<std::tuple<Args...>> _last;
  uint64_t _nextId = 1;
};

} // namespace margelo::nitro::nativepanels::rive
