// VRONoOpRenderPass.h
// @viro-external/render-passes
//
// Diagnostic child pass. Logs on render() but issues no draws. Used by the
// six-gate verification (spec §6, gate 5) to prove the multiplex dispatches
// to N children — attach one alongside splat-pass and confirm both fire in
// the same frame via the MultiplexPass log line.
//
// This is NOT the orb-pass. When a real orb-pass package lands, delete this.

#ifndef VIRO_EXTERNAL_RENDER_PASSES_VRONOOPRENDERPASS_H
#define VIRO_EXTERNAL_RENDER_PASSES_VRONOOPRENDERPASS_H

#include "VRORenderPass.h"
#include <memory>

namespace viroexternal {
namespace renderpasses {

class VRONoOpRenderPass final : public VRORenderPass {
public:
    VRONoOpRenderPass();
    ~VRONoOpRenderPass() override;

    void render(std::shared_ptr<VROScene> scene,
                std::shared_ptr<VROScene> outgoingScene,
                VRORenderPassInputOutput &inputs,
                VRORenderContext *context,
                std::shared_ptr<VRODriver> &driver) override;
};

}  // namespace renderpasses
}  // namespace viroexternal

#endif  // VIRO_EXTERNAL_RENDER_PASSES_VRONOOPRENDERPASS_H
