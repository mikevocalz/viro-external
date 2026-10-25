//
//  ReplayingListenerSetTest.cpp — host test for the Rive panel's state
//  listener set (RivePanelListeners delivers through it).
//
//  Run from packages/native-panels:
//    sh android/src/test/cpp/run-host-tests.sh
//

#include "../../main/cpp/rive/ReplayingListenerSet.hpp"

#include <atomic>
#include <chrono>
#include <cstdio>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

using namespace margelo::nitro::nativepanels::rive;

namespace {

int failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what);
    ++failures;
  }
}

struct Received {
  std::mutex mutex;
  std::vector<std::pair<int, std::string>> values;
};

// Stands in for a Nitro Callback: copyable, delivers through callAndForget.
struct RecordingListener {
  std::shared_ptr<Received> received;
  void callAndForget(const int& state, const std::string& detail) const {
    std::lock_guard lock(received->mutex);
    received->values.emplace_back(state, detail);
  }
};

using Set = ReplayingListenerSet<RecordingListener, int, std::string>;

void testLateListenerReceivesTheLastStateAndDetail() {
  Set set;
  set.emit(1, "");
  set.emit(4, "artboard \"Main\" not found");
  auto received = std::make_shared<Received>();
  set.add(RecordingListener{received});
  check(received->values.size() == 1, "a late listener receives exactly one replayed value");
  check(received->values.size() == 1 && received->values[0].first == 4, "the replay is the last state");
  check(received->values.size() == 1 && received->values[0].second == "artboard \"Main\" not found",
        "the replay carries the last detail");
  set.emit(2, "");
  check(received->values.size() == 2 && received->values[1].first == 2, "later emissions follow the replay");
}

void testNoReplayBeforeTheFirstEmission() {
  Set set;
  auto received = std::make_shared<Received>();
  set.add(RecordingListener{received});
  check(received->values.empty(), "nothing is replayed before anything was emitted");
}

void testRemovedListenerStopsAndClearKeepsTheLastValue() {
  Set set;
  auto first = std::make_shared<Received>();
  const uint64_t id = set.add(RecordingListener{first});
  set.emit(1, "");
  set.remove(id);
  set.emit(2, "");
  check(first->values.size() == 1, "a removed listener receives nothing more");
  set.clear();
  set.emit(5, "disposed");
  auto late = std::make_shared<Received>();
  set.add(RecordingListener{late});
  check(late->values.size() == 1 && late->values[0].first == 5, "clear() keeps the last value for later listeners");
}

struct SelfReentrantListener {
  ReplayingListenerSet<SelfReentrantListener, int, std::string>* set;
  std::shared_ptr<std::atomic<int>> calls;
  void callAndForget(const int&, const std::string&) const {
    if (calls->fetch_add(1) == 0) set->add(*this);
  }
};

void testListenerMayAddToTheSameSetFromInsideItsCall() {
  ReplayingListenerSet<SelfReentrantListener, int, std::string> set;
  auto calls = std::make_shared<std::atomic<int>>(0);
  set.add(SelfReentrantListener{&set, calls});
  set.emit(1, "");
  // First call from emit adds a copy, which receives the replay of 1.
  check(calls->load() == 2, "re-entering add() on the emitting thread replays without deadlocking");
}

// Its first call, which is the replay when one is due, sleeps before
// recording. That holds the gap between add() reading the last value and
// delivering it open long enough for an emission to land inside it.
struct SlowFirstCallListener {
  std::shared_ptr<Received> received;
  std::shared_ptr<std::atomic<int>> calls;
  void callAndForget(const int& state, const std::string& detail) const {
    if (calls->fetch_add(1) == 0) std::this_thread::sleep_for(std::chrono::milliseconds(2));
    std::lock_guard lock(received->mutex);
    received->values.emplace_back(state, detail);
  }
};

void testReplayNeverArrivesAfterANewerEmission() {
  // One thread emits increasing values until another has added its
  // listeners. Every listener must see non-decreasing values: a stale replay
  // delivered after a newer emission shows up as a decrease.
  constexpr size_t kListeners = 150;
  ReplayingListenerSet<SlowFirstCallListener, int, std::string> set;
  set.emit(0, "");
  std::vector<std::shared_ptr<Received>> all;
  std::atomic<bool> isAdderDone{false};
  std::thread emitter([&]() {
    for (int i = 1; !isAdderDone.load(); ++i) set.emit(i, "");
  });
  std::thread adder([&]() {
    for (size_t n = 0; n < kListeners; ++n) {
      auto received = std::make_shared<Received>();
      set.add(SlowFirstCallListener{received, std::make_shared<std::atomic<int>>(0)});
      all.push_back(std::move(received));
    }
    isAdderDone = true;
  });
  adder.join();
  emitter.join();
  size_t decreases = 0;
  for (const auto& received : all) {
    std::lock_guard lock(received->mutex);
    for (size_t i = 1; i < received->values.size(); ++i) {
      if (received->values[i].first < received->values[i - 1].first) ++decreases;
    }
  }
  if (decreases > 0) std::fprintf(stderr, "  %zu out-of-order deliveries\n", decreases);
  check(decreases == 0, "no listener sees a replay older than an emission it already received");
}

} // namespace

int main() {
  testLateListenerReceivesTheLastStateAndDetail();
  testNoReplayBeforeTheFirstEmission();
  testRemovedListenerStopsAndClearKeepsTheLastValue();
  testListenerMayAddToTheSameSetFromInsideItsCall();
  testReplayNeverArrivesAfterANewerEmission();
  if (failures == 0) std::printf("ReplayingListenerSet: all host tests passed\n");
  return failures == 0 ? 0 : 1;
}
