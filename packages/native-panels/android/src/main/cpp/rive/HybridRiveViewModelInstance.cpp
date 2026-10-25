//
//  HybridRiveViewModelInstance.cpp — @viro-external/native-panels
//

#include "HybridRiveViewModelInstance.hpp"

#include "RivePanelConfig.hpp"

#include <NitroNativePanels/RiveViewModelUpdate.hpp>

#include <stdexcept>
#include <utility>

namespace margelo::nitro::nativepanels {

namespace {

void requireQueued(bool queued) {
  // VRORivePanel rejects commands only after dispose().
  if (!queued) throw std::runtime_error("RivePanel is disposed");
}

} // namespace

HybridRiveViewModelInstance::HybridRiveViewModelInstance(std::shared_ptr<VRORivePanel> panel)
    : _panel(std::move(panel)) {}

void HybridRiveViewModelInstance::setNumber(const std::string& path, double value) {
  const float number = rive::checkedViewModelNumber(path, value);
  requireQueued(_panel->setNumber(path, number));
}

void HybridRiveViewModelInstance::setBoolean(const std::string& path, bool value) {
  requireQueued(_panel->setBoolean(path, value));
}

void HybridRiveViewModelInstance::setString(const std::string& path, const std::string& value) {
  requireQueued(_panel->setString(path, value));
}

void HybridRiveViewModelInstance::fireTrigger(const std::string& path) {
  requireQueued(_panel->fireTrigger(path));
}

void HybridRiveViewModelInstance::applyUpdate(const RiveViewModelUpdate& update) {
  // Validate the whole batch before queueing any of it.
  if (update.numbers.has_value()) {
    for (const auto& [path, value] : *update.numbers) rive::checkedViewModelNumber(path, value);
  }
  if (update.numbers.has_value()) {
    for (const auto& [path, value] : *update.numbers) {
      requireQueued(_panel->setNumber(path, static_cast<float>(value)));
    }
  }
  if (update.booleans.has_value()) {
    for (const auto& [path, value] : *update.booleans) requireQueued(_panel->setBoolean(path, value));
  }
  if (update.strings.has_value()) {
    for (const auto& [path, value] : *update.strings) requireQueued(_panel->setString(path, value));
  }
  if (update.triggers.has_value()) {
    for (const auto& path : *update.triggers) requireQueued(_panel->fireTrigger(path));
  }
}

} // namespace margelo::nitro::nativepanels
