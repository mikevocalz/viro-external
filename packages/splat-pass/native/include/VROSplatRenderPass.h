//
//  VROSplatRenderPass.h
//  @viro-external/splat-pass
//
//  Native 3DGS render pass. Subclasses VRORenderPass from
//  mikevocalz/virocore (branch v2.55.0-nitro-canvas, post-83b7f427).
//  Installed via VROChoreographer::setCustomPostOpaquePass().
//
//  Pipeline per render() invocation (fires per-eye since the
//  Choreographer runs per-eye on the OpenXR backend):
//
//    GLStateScope state_scope;   // saves caller GL state
//    bind 1x1 placeholder texture on unit 0  (#436 guard)
//    if (has4D && first eye of this frame):
//        compute decode  → live splat SSBO  for current timestamp
//    compute sort        → depth-key SSBO  for THIS eye
//    raster draw indirect → premultiplied-alpha blend into the
//                           Choreographer's bound HDR target.
//    ~GLStateScope        // restores caller GL state
//

#ifndef VIRO_EXTERNAL_SPLAT_VROSPLATRENDERPASS_H
#define VIRO_EXTERNAL_SPLAT_VROSPLATRENDERPASS_H

#include "VRORenderPass.h"
#include <GLES3/gl31.h>
#include <memory>
#include <atomic>
#include <string>
#include <functional>
#include <mutex>
#include <thread>
#include <condition_variable>
#include <vector>
#include <cstdint>
#include <array>

namespace viroexternal {
namespace splat {

class SplatBuffers;

enum class SplatSourceFormat { SPZ, Splat, Ply, KSplat };

struct SplatPassConfig {
    std::string uri;
    SplatSourceFormat format = SplatSourceFormat::SPZ;
    GLsizei maxSplats         = 1500000;
    GLuint  sortWorkgroupSize = 32;
    GLuint  decodeWorkgroupSize = 64;
    int32_t priority          = 0;
    bool    has4D             = false;
    // Live timestamp accessor — called once per frame from render().
    // Stored as std::function so the JNI bridge can wire it from the JS
    // side without leaking JNI types into the pass.
    std::function<float()> getTimestamp;
};

class VROSplatRenderPass final : public VRORenderPass {
public:
    explicit VROSplatRenderPass(const SplatPassConfig &config);
    ~VROSplatRenderPass() override;

    VROSplatRenderPass(const VROSplatRenderPass&) = delete;
    VROSplatRenderPass& operator=(const VROSplatRenderPass&) = delete;

    // From VRORenderPass.
    void render(std::shared_ptr<VROScene> scene,
                std::shared_ptr<VROScene> outgoingScene,
                VRORenderPassInputOutput &inputs,
                VRORenderContext *context,
                std::shared_ptr<VRODriver> &driver) override;

    // Live splat count for the current frame. Atomic — readable from JS
    // poll without a render-thread lock.
    GLsizei splatCount() const { return _splatCount.load(); }

    // Rolling per-frame timing — sampled at the end of render(). Returned
    // in ms; JS treats anything > 16.6ms as a drop signal on 60Hz.
    double  lastFrameMs() const { return _lastFrameMs.load(); }
    int     droppedFrames() const { return _droppedFrames.load(); }

    // Source-set hand-off. The JNI bridge calls this after parsing the
    // SPZ binary on a worker thread. The pass copies the decoded splats
    // into the SSBO ring on the next render() it sees.
    void stagePendingSource(std::shared_ptr<const std::vector<uint8_t>> bytes,
                            GLsizei splatCount);

    // Set once on first lazyInit() from glGetString(GL_RENDERER).
    // Readable from any thread without a lock — fed back to JS via the
    // JNI deviceProfile() accessor.
    static const char *detectedDeviceProfileId();

private:
    void lazyInit();
    void compilePrograms();
    void create1x1PlaceholderTexture();
    void detectAndPublishDeviceProfile();

    void runDecodePass(VRORenderContext *context);
    void runSortPass(VRORenderContext *context);
    void runRasterPass(VRORenderContext *context, VRORenderPassInputOutput &inputs);

    // CPU bucket-sort worker — same algorithm as three.js mkkellogg /
    // SparkJS, but on a dedicated thread so the GL thread never blocks.
    // Snapshot view matrix from render thread → sort → publish sortedIndex
    // → render thread uploads on its next frame. Worker runs at whatever
    // FPS it can (5-15Hz for 500k splats); render maintains 90Hz reading
    // whatever's most recently sorted. IPD-driven per-eye sort diff is
    // negligible at human viewing distances, so both eyes share one sort.
    void startSortWorker();
    void stopSortWorker();
    void sortWorkerLoop();

    SplatPassConfig _config;

    bool _initialized = false;
    std::unique_ptr<SplatBuffers> _buffers;

    GLuint _programDecode = 0;
    GLuint _programSort   = 0;
    GLuint _programRaster = 0;

    // Empty VAO — the raster pass pulls all attributes from SSBOs by
    // gl_VertexID. Required because GLES 3.1 still mandates a bound VAO
    // for glDrawArraysIndirect.
    GLuint _emptyVAO = 0;

    GLuint _placeholderTexture = 0;

    // Track the last frame we decoded so the second eye in the same
    // frame reuses the result. VRORenderContext::getFrame() is the
    // monotonic frame counter Viro sets at the top of prepareFrame.
    int _lastDecodedFrame = -1;

    std::atomic<GLsizei> _splatCount { 0 };
    std::atomic<double>  _lastFrameMs { 0.0 };
    std::atomic<int>     _droppedFrames { 0 };

    // Pending source set staged from a worker thread; consumed on the
    // next render() that holds the GL context.
    std::mutex _pendingMutex;
    std::shared_ptr<const std::vector<uint8_t>> _pendingSource;
    GLsizei _pendingSplatCount = 0;

    // CPU positions cache for sort. Populated once the first staged source
    // drains. Immutable after that — shared with the sort worker by ref.
    std::vector<float> _positionsXYZ;

    // ── Sort worker plumbing ────────────────────────────────────────
    // Render thread pushes the latest view matrix; worker pulls it,
    // sorts, publishes _sortedIndexPublish. Render thread copies the
    // latest publish into the GPU SSBO on its next frame.
    std::thread             _sortThread;
    std::atomic<bool>       _sortRunning { false };

    std::mutex              _viewMutex;
    std::array<float, 16>   _pendingView { {1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1} };
    bool                    _hasPendingView = false;
    std::condition_variable _viewCv;

    std::mutex              _publishMutex;
    std::vector<uint32_t>   _sortedIndexPublish;
    bool                    _publishReady = false;

    // Render-thread scratch — refilled from _sortedIndexPublish under the
    // publish lock, then uploaded to the SSBO without the lock held.
    std::vector<uint32_t>   _sortedIndexUpload;

    // Render-thread state: last frame for which we pushed a view matrix
    // (gates per-frame work to once per pair of eyes) and a copy of the
    // last-pushed view used to skip pushes when the user is stationary.
    int                     _lastPushedFrame = -1;
    std::array<float, 16>   _lastPushedView { {0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0} };
};

}  // namespace splat
}  // namespace viroexternal

#endif  // VIRO_EXTERNAL_SPLAT_VROSPLATRENDERPASS_H
