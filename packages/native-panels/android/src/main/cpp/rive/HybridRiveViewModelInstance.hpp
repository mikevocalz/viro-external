//
//  HybridRiveViewModelInstance.hpp — @viro-external/native-panels
//
//  Writes to the default view-model instance of one VRORivePanel. Every call
//  enqueues a command on the panel's render thread and returns.
//

#pragma once

#include "../vendor/virocore/VRORivePanel.h"

#include <NitroNativePanels/HybridRiveViewModelInstanceSpec.hpp>

#include <memory>

namespace margelo::nitro::nativepanels {

class HybridRiveViewModelInstance final : public HybridRiveViewModelInstanceSpec {
public:
  explicit HybridRiveViewModelInstance(std::shared_ptr<VRORivePanel> panel);

  void setNumber(const std::string& path, double value) override;
  void setBoolean(const std::string& path, bool value) override;
  void setString(const std::string& path, const std::string& value) override;
  void fireTrigger(const std::string& path) override;
  void applyUpdate(const RiveViewModelUpdate& update) override;

private:
  const std::shared_ptr<VRORivePanel> _panel;
};

} // namespace margelo::nitro::nativepanels
