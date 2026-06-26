// ViroSplatPassRegistry.h
//
// Process-wide registry of live VROSplatRenderPass instances keyed by
// the string id surfaced to JS. Lives in the splat-pass native library
// (not ViroCore) so stock Viro builds stay clean.
//
// The JNI shim is the only intended caller. The registry attaches the
// pass to a caller-supplied choreographer; it does not look up the
// active VROSceneRenderer itself (that's a JNI concern — different
// objects exist on different Viro views).

#pragma once

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

class VROChoreographer;

namespace viroexternal {
namespace splat {

class VROSplatRenderPass;
struct SplatPassConfig;

struct RegisterResult {
    std::string id;
    std::shared_ptr<VROSplatRenderPass> pass;
};

class ViroSplatPassRegistry {
 public:
    static ViroSplatPassRegistry &shared();

    // Build the pass, attach to the choreographer, and store under a
    // fresh id. Caller retains the choreographer ownership; the pass
    // detaches itself from the choreographer on `detach(id)`.
    RegisterResult attach(const std::shared_ptr<VROChoreographer> &choreo,
                          const SplatPassConfig &cfg);

    // Detach + release. Idempotent; returns false if id was unknown.
    bool detach(const std::string &id);

    // O(1) lookup for the JNI metrics / splatCount methods.
    std::shared_ptr<VROSplatRenderPass> find(const std::string &id);

 private:
    ViroSplatPassRegistry() = default;
    ViroSplatPassRegistry(const ViroSplatPassRegistry &) = delete;
    ViroSplatPassRegistry &operator=(const ViroSplatPassRegistry &) = delete;

    struct Entry {
        std::shared_ptr<VROSplatRenderPass> pass;
        std::weak_ptr<VROChoreographer> choreo;
    };

    std::mutex _mutex;
    std::unordered_map<std::string, Entry> _entries;
    std::atomic<uint64_t> _idCounter{0};
};

}  // namespace splat
}  // namespace viroexternal
