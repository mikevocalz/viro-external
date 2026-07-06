// ViroExternalPassRegistry.h
// @viro-external/render-passes
//
// Process-wide registry that attaches a `VROMultiplexRenderPass` to a
// choreographer on first child attach, adds subsequent children into that
// same multiplex, and clears the choreographer's custom-post-opaque slot
// when the last child detaches.
//
// Consumers: `@viro-external/splat-pass` (after step 4 of TASKS.md), the
// forthcoming orb-pass package, and any future custom pass. They link
// against `libviro_external_render_passes.so` and call attachChild /
// detachChild directly — no JNI in this package for the attach path,
// since the child pass object cannot cross JNI cleanly (it's a
// `shared_ptr<VRORenderPass>`).
//
// The JNI in this package is diagnostics-only (childCount, ids).

#pragma once

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

class VROChoreographer;
class VRORenderPass;

namespace viroexternal {
namespace renderpasses {

class VROMultiplexRenderPass;

struct AttachResult {
    std::string id;     // stable opaque id for the child
    bool created;       // true if this attach installed a fresh multiplex
};

class ViroExternalPassRegistry {
public:
    static ViroExternalPassRegistry &shared();

    // Attach a child pass to `choreo`. If no multiplex exists for this
    // choreographer yet, one is created and installed via
    // `choreo->setCustomPostOpaquePass(multiplex)`. Higher priority renders
    // later (last writer wins on the HDR target before tone-map).
    AttachResult attachChild(const std::shared_ptr<VROChoreographer> &choreo,
                             const std::shared_ptr<VRORenderPass> &pass,
                             int32_t priority);

    // Detach by id. When the last child is removed from a choreographer's
    // multiplex, the choreographer's slot is cleared and the multiplex
    // released. Idempotent — returns false for unknown ids.
    bool detachChild(const std::string &id);

    // Diagnostics — safe from any thread.
    size_t childCount(const std::shared_ptr<VROChoreographer> &choreo) const;
    std::vector<std::string> childIdsOrdered(
        const std::shared_ptr<VROChoreographer> &choreo) const;

private:
    ViroExternalPassRegistry() = default;
    ViroExternalPassRegistry(const ViroExternalPassRegistry&) = delete;
    ViroExternalPassRegistry &operator=(const ViroExternalPassRegistry&) = delete;

    struct Entry {
        std::weak_ptr<VROChoreographer> choreo;
        std::shared_ptr<VROMultiplexRenderPass> multiplex;
    };

    // Key by raw VROChoreographer* — one multiplex per choreographer, and
    // choreographer identity is stable for its lifetime. weak_ptr<>::owner_before
    // works but is opaque; a raw pointer keyed lookup is simpler and matches
    // splat-pass's registry approach of caller-owned choreographers.
    mutable std::mutex _mutex;
    std::unordered_map<const VROChoreographer *, Entry> _entries;
    std::unordered_map<std::string, const VROChoreographer *> _idToChoreo;
    std::atomic<uint64_t> _idCounter{0};
};

}  // namespace renderpasses
}  // namespace viroexternal
