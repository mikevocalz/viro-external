//
//  HybridRivePanel.cpp — @viro-external/native-panels
//

#include "HybridRivePanel.hpp"

#include <NitroNativePanels/RivePanelOptions.hpp>

#include <stdexcept>
#include <utility>

#if NATIVE_PANELS_WITH_VIRO_RIVE

#include "HybridRiveFile.hpp"
#include "HybridRiveViewModelInstance.hpp"
#include "RivePanelConfig.hpp"
#include "RivePanelListeners.hpp"
#include "RivePanelStateMapping.hpp"
#include "RiveSurfaceLink.hpp"

#include <android/log.h>

namespace margelo::nitro::nativepanels {

namespace {

using PanelPromise = Promise<std::shared_ptr<HybridRivePanelSpec>>;

void requireQueued(bool queued) {
  // VRORivePanel rejects commands only after dispose().
  if (!queued) throw std::runtime_error("RivePanel is disposed");
}

rive::RivePanelConfigInput configInput(const RivePanelOptions& options) {
  rive::RivePanelConfigInput input;
  input.surfaceId = options.surfaceId;
  input.widthPx = options.widthPx;
  input.heightPx = options.heightPx;
  input.fit = static_cast<rive::FitMode>(static_cast<int32_t>(options.fit));
  input.alignmentX = options.alignmentX;
  input.alignmentY = options.alignmentY;
  input.cornerRadiusM = options.cornerRadiusM;
  input.panelWidthM = options.panelWidthM;
  input.panelHeightM = options.panelHeightM;
  input.maxFrameRateHz = options.maxFrameRateHz;
  return input;
}

VRORivePanelOptions panelOptions(const rive::RivePanelConfig& config) {
  VRORivePanelOptions options;
  // ADR 0001 "Corner ownership": Viro rounds at the consumer, so the producer
  // draws square and the radii are used for hit testing only.
  options.cornerRadiusPx = 0.0f;
  options.coverageRadiusXPx = config.coverageRadiusXPx;
  options.coverageRadiusYPx = config.coverageRadiusYPx;
  options.fit = static_cast<VRORivePanelFit>(static_cast<int32_t>(config.fit));
  options.alignmentX = config.alignmentX;
  options.alignmentY = config.alignmentY;
  options.maxFrameRateHz = config.maxFrameRateHz;
  return options;
}

} // namespace

HybridRivePanel::HybridRivePanel(std::shared_ptr<VRORivePanel> panel, std::shared_ptr<RivePanelListeners> listeners,
                                 std::unique_ptr<rive::RiveSurfaceLink> link)
    : _panel(std::move(panel)),
      _listeners(std::move(listeners)),
      _viewModel(std::make_shared<HybridRiveViewModelInstance>(_panel)),
      _link(std::move(link)) {}

HybridRivePanel::~HybridRivePanel() {
  try {
    dispose();
  } catch (const std::exception& error) {
    __android_log_print(ANDROID_LOG_ERROR, "NativePanelsRive", "RivePanel teardown failed: %s", error.what());
  }
}

bool HybridRivePanel::getIsAvailable() {
  if (!VRORivePanel::isAvailable()) return false;
  facebook::jni::ThreadScope scope;
  return rive::JRiveSurfaceLink::isRegistryAvailable();
}

PanelPromise HybridRivePanel::create(const RivePanelOptions& options) {
  // Runs on the JS thread: the file bytes are read here, and VRORivePanel
  // only starts its worker thread and queues commands, so nothing blocks.
  try {
    if (!VRORivePanel::isAvailable()) {
      throw std::runtime_error("RivePanel is unavailable: libviro_renderer.so was built without Rive for this ABI "
                               "(Rive needs arm64-v8a)");
    }
    const rive::RivePanelConfig config = rive::resolveRivePanelConfig(configInput(options));
    const std::vector<uint8_t>& bytes = HybridRiveFile::bytesOf(options.file);

    auto listeners = std::make_shared<RivePanelListeners>();
    std::weak_ptr<RivePanelListeners> weakListeners = listeners;
    auto panel = VRORivePanel::create(
        nullptr, config.widthPx, config.heightPx, panelOptions(config),
        [weakListeners](VRORivePanelState state, const std::string& detail) {
          if (auto target = weakListeners.lock()) target->emit(rive::toRivePanelState(state), detail);
        });
    if (panel == nullptr) throw std::runtime_error("VRORivePanel::create failed to start its render thread");

    try {
      // Selections first: loadFile instantiates the artboard and state
      // machine named by the latest select calls.
      requireQueued(panel->selectArtboard(options.artboardName.value_or("")));
      requireQueued(panel->selectStateMachine(options.stateMachineName.value_or("")));
      requireQueued(panel->loadFile(bytes.data(), bytes.size()));
      auto target = std::make_unique<rive::RiveSurfaceTarget>(panel, listeners, config.widthPx, config.heightPx);
      auto link = std::make_unique<rive::RiveSurfaceLink>(config.surfaceId, std::move(target));
      std::shared_ptr<HybridRivePanelSpec> result =
          std::make_shared<HybridRivePanel>(panel, std::move(listeners), std::move(link));
      return PanelPromise::resolved(std::move(result));
    } catch (...) {
      panel->dispose();
      throw;
    }
  } catch (...) {
    return PanelPromise::rejected(std::current_exception());
  }
}

RivePanelState HybridRivePanel::getState() {
  return rive::toRivePanelState(_panel->getState());
}

std::shared_ptr<HybridRiveViewModelInstanceSpec> HybridRivePanel::getViewModelInstance() {
  return _viewModel;
}

void HybridRivePanel::setFile(const std::shared_ptr<HybridRiveFileSpec>& file) {
  const std::vector<uint8_t>& bytes = HybridRiveFile::bytesOf(file);
  requireQueued(_panel->loadFile(bytes.data(), bytes.size()));
}

void HybridRivePanel::selectArtboard(const std::string& name) {
  requireQueued(_panel->selectArtboard(name));
}

void HybridRivePanel::selectStateMachine(const std::string& name) {
  requireQueued(_panel->selectStateMachine(name));
}

void HybridRivePanel::dispatchPointer(RivePointerPhase phase, double xPx, double yPx, double pointerId) {
  rive::checkPointerPosition(xPx, yPx);
  const int32_t id = rive::checkedInt32(pointerId, "pointerId");
  const auto x = static_cast<float>(xPx);
  const auto y = static_cast<float>(yPx);
  switch (phase) {
    case RivePointerPhase::DOWN: requireQueued(_panel->pointerDown(x, y, id)); return;
    case RivePointerPhase::MOVE: requireQueued(_panel->pointerMove(x, y, id)); return;
    // Rive's state machine has no cancel input; end the press where it is.
    case RivePointerPhase::UP:
    case RivePointerPhase::CANCEL: requireQueued(_panel->pointerUp(x, y, id)); return;
  }
  throw std::invalid_argument("RivePanel pointer phase is not a known value");
}

void HybridRivePanel::setActive(bool active) {
  requireQueued(_panel->setActive(active));
}

ListenerSubscription HybridRivePanel::addOnStateChangedListener(
    const Callback<void(RivePanelState, const std::string&)>& listener) {
  return _listeners->add(listener);
}

void HybridRivePanel::dispose() {
  std::call_once(_disposeOnce, [this]() {
    // Stop Surface events first, so no attach can race the teardown.
    if (_link != nullptr) _link->close();
    _panel->dispose();
    _listeners->clear();
  });
}

} // namespace margelo::nitro::nativepanels

#else // NATIVE_PANELS_WITH_VIRO_RIVE

namespace margelo::nitro::nativepanels {

// No libviro_renderer.so for this ABI (Viro ships arm64-v8a and armeabi-v7a).
// Instances are never created here, so only the statics are defined.
bool HybridRivePanel::getIsAvailable() {
  return false;
}

Promise<std::shared_ptr<HybridRivePanelSpec>> HybridRivePanel::create(const RivePanelOptions&) {
  return Promise<std::shared_ptr<HybridRivePanelSpec>>::rejected(std::make_exception_ptr(
      std::runtime_error("RivePanel is unavailable: this ABI has no libviro_renderer.so to link")));
}

} // namespace margelo::nitro::nativepanels

#endif // NATIVE_PANELS_WITH_VIRO_RIVE
