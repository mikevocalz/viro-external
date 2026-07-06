// VROMultiplexRenderPass.h
// @viro-external/render-passes
//
// Single VRORenderPass installed on VROChoreographer::setCustomPostOpaquePass
// that dispatches to N ordered child passes. Exists because the choreographer
// slot is single (VROChoreographer.h:236) — attaching a second pass silently
// overwrites the first, so orb + splat + future custom passes cannot coexist
// without this multiplex.
//
// Contract:
//   • Priority ascending — lower renders first. Splat-pass's SplatPassConfig.priority
//     field maps directly.
//   • GLStateScope is a CHILD responsibility. This class does NOT wrap children
//     in a scope. Nested restore is the wrong contract; splat-pass already owns
//     its own restore, orb-pass must too. See render-passes/AGENTS.md.
//   • Thread-safe add / remove: multiplex is queried per-frame from the render
//     thread; attach / detach can arrive from any JS-facing thread.

#ifndef VIRO_EXTERNAL_RENDER_PASSES_VROMULTIPLEXRENDERPASS_H
#define VIRO_EXTERNAL_RENDER_PASSES_VROMULTIPLEXRENDERPASS_H

#include "VRORenderPass.h"
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace viroexternal {
namespace renderpasses {

class VROMultiplexRenderPass final : public VRORenderPass {
public:
    VROMultiplexRenderPass();
    ~VROMultiplexRenderPass() override;

    VROMultiplexRenderPass(const VROMultiplexRenderPass&) = delete;
    VROMultiplexRenderPass& operator=(const VROMultiplexRenderPass&) = delete;

    // From VRORenderPass. Iterates children in priority-ascending order and
    // calls their render(...) with the same inputs / context / driver the
    // choreographer handed us. Snapshots the child vector under the lock so
    // the render call itself is lock-free.
    void render(std::shared_ptr<VROScene> scene,
                std::shared_ptr<VROScene> outgoingScene,
                VRORenderPassInputOutput &inputs,
                VRORenderContext *context,
                std::shared_ptr<VRODriver> &driver) override;

    // Add a child. Sorted-insert by priority. `id` is caller-supplied and
    // must be unique within this multiplex — the registry owns id generation.
    void addChild(const std::string &id,
                  std::shared_ptr<VRORenderPass> pass,
                  int32_t priority);

    // Remove a child by id. Returns true if removed, false if id unknown.
    bool removeChild(const std::string &id);

    // Diagnostics — safe from any thread.
    size_t childCount() const;
    std::vector<std::string> childIdsOrdered() const;

private:
    struct Child {
        std::string id;
        std::shared_ptr<VRORenderPass> pass;
        int32_t priority = 0;
    };

    mutable std::mutex _mutex;
    std::vector<Child> _children;   // kept sorted ascending by priority
};

}  // namespace renderpasses
}  // namespace viroexternal

#endif  // VIRO_EXTERNAL_RENDER_PASSES_VROMULTIPLEXRENDERPASS_H
