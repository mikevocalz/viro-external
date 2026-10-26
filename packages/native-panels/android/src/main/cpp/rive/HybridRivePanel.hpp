//
//  HybridRivePanel.hpp — @viro-external/native-panels
//
//  RivePanel HybridObject: forwards JS commands to ViroCore's VRORivePanel
//  (libviro_renderer.so) and keeps it attached to the Viro Surface for its
//  surface id through RiveSurfaceLink.
//
//  Built for ABIs whose libviro_renderer.so is available at configure time
//  (NATIVE_PANELS_WITH_VIRO_RIVE=1). Elsewhere only the statics exist:
//  isAvailable is false and create() rejects.
//

#pragma once

#include "../vendor/virocore/VRORivePanel.h"

#include <NitroNativePanels/HybridRivePanelSpec.hpp>

#include <atomic>
#include <memory>
#include <mutex>

namespace margelo::nitro::nativepanels {

class RivePanelListeners;
namespace rive {
class RiveSurfaceLink;
}

class HybridRivePanel final : public HybridRivePanelSpec {
public:
  HybridRivePanel(std::shared_ptr<VRORivePanel> panel, std::shared_ptr<RivePanelListeners> listeners,
                  std::unique_ptr<rive::RiveSurfaceLink> link);
  ~HybridRivePanel() override;

  static Promise<std::shared_ptr<HybridRivePanelSpec>> create(const RivePanelOptions& options);
  static bool getIsAvailable();

  RivePanelState getState() override;
  std::shared_ptr<HybridRiveViewModelInstanceSpec> getViewModelInstance() override;

  void setFile(const std::shared_ptr<HybridRiveFileSpec>& file) override;
  void selectArtboard(const std::string& name) override;
  void selectStateMachine(const std::string& name) override;
  void dispatchPointer(RivePointerPhase phase, double xPx, double yPx, double pointerId) override;
  void setActive(bool active) override;
  ListenerSubscription addOnStateChangedListener(
      const Callback<void(RivePanelState, const std::string&)>& listener) override;

  // Ends the Surface subscription, then disposes the VRORivePanel (which
  // blocks until its render thread has freed every Rive and EGL object),
  // then drops the listeners. Idempotent.
  void dispose() override;

private:
  const std::shared_ptr<VRORivePanel> _panel;
  const std::shared_ptr<RivePanelListeners> _listeners;
  const std::shared_ptr<HybridRiveViewModelInstanceSpec> _viewModel;
  std::unique_ptr<rive::RiveSurfaceLink> _link;
  std::once_flag _disposeOnce;
};

} // namespace margelo::nitro::nativepanels
