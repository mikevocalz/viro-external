// VRONoOpRenderPass.cpp
// @viro-external/render-passes

#include "VRONoOpRenderPass.h"
#include "VRORenderContext.h"
#include "VROLog.h"

#include <atomic>

namespace viroexternal {
namespace renderpasses {

VRONoOpRenderPass::VRONoOpRenderPass() = default;
VRONoOpRenderPass::~VRONoOpRenderPass() = default;

void VRONoOpRenderPass::render(std::shared_ptr<VROScene> scene,
                                std::shared_ptr<VROScene> outgoingScene,
                                VRORenderPassInputOutput &inputs,
                                VRORenderContext *context,
                                std::shared_ptr<VRODriver> &driver) {
    static std::atomic<int> sFrames{0};
    int n = sFrames.fetch_add(1, std::memory_order_relaxed);
    if (n == 0 || n % 60 == 0) {
        pinfo("NoOpPass: render() #%d eye=%d frame=%d",
              n, (int)context->getEyeType(), context->getFrame());
    }
}

}  // namespace renderpasses
}  // namespace viroexternal
