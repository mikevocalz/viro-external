// ViroExternalPassRegistry.cpp
// @viro-external/render-passes

#include "ViroExternalPassRegistry.h"
#include "VROMultiplexRenderPass.h"

#include "VROChoreographer.h"
#include "VROLog.h"

#include <sstream>

namespace viroexternal {
namespace renderpasses {

ViroExternalPassRegistry &ViroExternalPassRegistry::shared() {
    static ViroExternalPassRegistry instance;
    return instance;
}

AttachResult ViroExternalPassRegistry::attachChild(
        const std::shared_ptr<VROChoreographer> &choreo,
        const std::shared_ptr<VRORenderPass> &pass,
        int32_t priority) {
    if (!choreo || !pass) return {"", false};

    std::lock_guard<std::mutex> lk(_mutex);

    const VROChoreographer *key = choreo.get();
    auto it = _entries.find(key);
    bool created = false;
    std::shared_ptr<VROMultiplexRenderPass> multiplex;

    if (it == _entries.end()) {
        multiplex = std::make_shared<VROMultiplexRenderPass>();
        choreo->setCustomPostOpaquePass(multiplex);
        _entries.emplace(key, Entry{choreo, multiplex});
        created = true;
        pinfo("MultiplexPass: installed on choreographer=%p", (void *)key);
    } else {
        multiplex = it->second.multiplex;
    }

    std::ostringstream oss;
    oss << "ext-" << _idCounter.fetch_add(1, std::memory_order_relaxed);
    std::string id = oss.str();
    multiplex->addChild(id, pass, priority);
    _idToChoreo.emplace(id, key);

    pinfo("MultiplexPass: attach id=%s priority=%d children=%zu",
          id.c_str(), (int)priority, multiplex->childCount());

    return {id, created};
}

bool ViroExternalPassRegistry::detachChild(const std::string &id) {
    std::lock_guard<std::mutex> lk(_mutex);

    auto idIt = _idToChoreo.find(id);
    if (idIt == _idToChoreo.end()) return false;
    const VROChoreographer *key = idIt->second;
    _idToChoreo.erase(idIt);

    auto eIt = _entries.find(key);
    if (eIt == _entries.end()) return false;

    auto multiplex = eIt->second.multiplex;
    multiplex->removeChild(id);

    pinfo("MultiplexPass: detach id=%s children=%zu",
          id.c_str(), multiplex->childCount());

    if (multiplex->childCount() == 0) {
        if (auto strong = eIt->second.choreo.lock()) {
            strong->setCustomPostOpaquePass(nullptr);
        }
        _entries.erase(eIt);
        pinfo("MultiplexPass: uninstalled from choreographer=%p", (void *)key);
    }
    return true;
}

size_t ViroExternalPassRegistry::childCount(
        const std::shared_ptr<VROChoreographer> &choreo) const {
    if (!choreo) return 0;
    std::lock_guard<std::mutex> lk(_mutex);
    auto it = _entries.find(choreo.get());
    return it == _entries.end() ? 0 : it->second.multiplex->childCount();
}

std::vector<std::string> ViroExternalPassRegistry::childIdsOrdered(
        const std::shared_ptr<VROChoreographer> &choreo) const {
    if (!choreo) return {};
    std::lock_guard<std::mutex> lk(_mutex);
    auto it = _entries.find(choreo.get());
    return it == _entries.end() ? std::vector<std::string>{}
                                 : it->second.multiplex->childIdsOrdered();
}

}  // namespace renderpasses
}  // namespace viroexternal
