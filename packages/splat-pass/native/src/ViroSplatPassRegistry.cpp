#include "ViroSplatPassRegistry.h"

#include <sstream>

#include "VROSplatRenderPass.h"
#include "VROChoreographer.h"

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
    choreo->setCustomPostOpaquePass(pass);

    std::ostringstream oss;
    oss << "splat-" << _idCounter.fetch_add(1, std::memory_order_relaxed);
    std::string id = oss.str();

    {
        std::lock_guard<std::mutex> lock(_mutex);
        _entries.emplace(id, Entry{pass, choreo});
    }
    return {id, pass};
}

bool ViroSplatPassRegistry::detach(const std::string &id) {
    Entry entry;
    {
        std::lock_guard<std::mutex> lock(_mutex);
        auto it = _entries.find(id);
        if (it == _entries.end()) return false;
        entry = std::move(it->second);
        _entries.erase(it);
    }
    if (auto choreo = entry.choreo.lock()) {
        choreo->setCustomPostOpaquePass(nullptr);
    }
    return true;
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
