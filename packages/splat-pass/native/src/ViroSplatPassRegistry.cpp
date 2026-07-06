#include "ViroSplatPassRegistry.h"

#include "VROSplatRenderPass.h"
#include "VROChoreographer.h"

// From @viro-external/render-passes — splat-pass links against
// libviro_external_render_passes.so to reach this. Direct
// setCustomPostOpaquePass calls are deprecated: a second registrant would
// silently overwrite splat, so the multiplex is now the sole owner of the
// choreographer's custom-post-opaque slot. See render-passes/doc/§0.
#include "ViroExternalPassRegistry.h"

namespace viroexternal {
namespace splat {

ViroSplatPassRegistry &ViroSplatPassRegistry::shared() {
    static ViroSplatPassRegistry instance;
    return instance;
}

RegisterResult ViroSplatPassRegistry::attach(
        const std::shared_ptr<VROChoreographer> &choreo,
        const SplatPassConfig &cfg) {
    auto pass = std::make_shared<VROSplatRenderPass>(cfg);
    auto result = viroexternal::renderpasses::ViroExternalPassRegistry::shared()
                      .attachChild(choreo, pass, cfg.priority);

    {
        std::lock_guard<std::mutex> lock(_mutex);
        _entries.emplace(result.id, Entry{pass, choreo});
    }
    return {result.id, pass};
}

bool ViroSplatPassRegistry::detach(const std::string &id) {
    {
        std::lock_guard<std::mutex> lock(_mutex);
        auto it = _entries.find(id);
        if (it == _entries.end()) return false;
        _entries.erase(it);
    }
    return viroexternal::renderpasses::ViroExternalPassRegistry::shared()
        .detachChild(id);
}

std::shared_ptr<VROSplatRenderPass> ViroSplatPassRegistry::find(
        const std::string &id) {
    std::lock_guard<std::mutex> lock(_mutex);
    auto it = _entries.find(id);
    if (it == _entries.end()) return nullptr;
    return it->second.pass;
}

}  // namespace splat
}  // namespace viroexternal
