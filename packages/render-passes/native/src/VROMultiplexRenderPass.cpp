// VROMultiplexRenderPass.cpp
// @viro-external/render-passes

#include "VROMultiplexRenderPass.h"

#include "VROLog.h"

#include <algorithm>
#include <atomic>

namespace viroexternal {
namespace renderpasses {

VROMultiplexRenderPass::VROMultiplexRenderPass() = default;
VROMultiplexRenderPass::~VROMultiplexRenderPass() = default;

void VROMultiplexRenderPass::render(std::shared_ptr<VROScene> scene,
                                     std::shared_ptr<VROScene> outgoingScene,
                                     VRORenderPassInputOutput &inputs,
                                     VRORenderContext *context,
                                     std::shared_ptr<VRODriver> &driver) {
    // Snapshot the children under the lock so the render calls themselves
    // (which may take a long time and touch GL) are lock-free. Attaches or
    // detaches arriving mid-frame land on the next frame's snapshot.
    std::vector<Child> snapshot;
    {
        std::lock_guard<std::mutex> lk(_mutex);
        snapshot = _children;
    }

    // ponytail: dispatch probe. First call and every 60th frame confirms
    // the multiplex is being invoked by the choreographer and shows the
    // active dispatch order. Remove once the six-gate verification passes.
    static std::atomic<int> sFrames{0};
    int n = sFrames.fetch_add(1, std::memory_order_relaxed);
    if (n == 0 || n % 3600 == 0) {
        std::string ids;
        for (size_t i = 0; i < snapshot.size(); ++i) {
            if (i > 0) ids += ", ";
            ids += snapshot[i].id;
        }
        pinfo("MultiplexPass: dispatch #%d children=%zu [%s]",
              n, snapshot.size(), ids.c_str());
    }

    for (const auto &child : snapshot) {
        if (child.pass) {
            child.pass->render(scene, outgoingScene, inputs, context, driver);
        }
    }
}

void VROMultiplexRenderPass::addChild(const std::string &id,
                                       std::shared_ptr<VRORenderPass> pass,
                                       int32_t priority) {
    if (!pass) return;
    std::lock_guard<std::mutex> lk(_mutex);
    Child c{id, std::move(pass), priority};
    auto it = std::upper_bound(
        _children.begin(), _children.end(), c,
        [](const Child &a, const Child &b) { return a.priority < b.priority; });
    _children.insert(it, std::move(c));
}

bool VROMultiplexRenderPass::removeChild(const std::string &id) {
    std::lock_guard<std::mutex> lk(_mutex);
    auto it = std::find_if(_children.begin(), _children.end(),
                            [&](const Child &c) { return c.id == id; });
    if (it == _children.end()) return false;
    _children.erase(it);
    return true;
}

size_t VROMultiplexRenderPass::childCount() const {
    std::lock_guard<std::mutex> lk(_mutex);
    return _children.size();
}

std::vector<std::string> VROMultiplexRenderPass::childIdsOrdered() const {
    std::lock_guard<std::mutex> lk(_mutex);
    std::vector<std::string> out;
    out.reserve(_children.size());
    for (const auto &c : _children) out.push_back(c.id);
    return out;
}

}  // namespace renderpasses
}  // namespace viroexternal
