//
//  VROSplatRenderPass.cpp
//  @viro-external/splat-pass
//

#include "VROSplatRenderPass.h"
#include "SplatBuffers.h"
#include "GLStateScope.h"
#include "VRORenderContext.h"
#include "VROLog.h"
#include "VROMatrix4f.h"

#include "ShaderSources.h"   // SPLAT_VERT_GLSL, SPLAT_FRAG_GLSL, SPLAT_SORT_COMP_GLSL, SPLAT_DECODE_COMP_GLSL

#include <cstring>
#include <sys/resource.h>  // setpriority — lower worker thread nice level
#include <sys/syscall.h>   // SYS_gettid — Linux/Android thread id
#include <unistd.h>        // syscall()

namespace viroexternal {
namespace splat {

namespace {

// Sentinel for "no compile error" in compileShader return.
constexpr GLuint kInvalidProgram = 0;

GLuint compileShader(GLenum type, const char *source) {
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint ok = 0;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        GLint logLen = 0;
        glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &logLen);
        std::string log(static_cast<size_t>(logLen), '\0');
        glGetShaderInfoLog(shader, logLen, nullptr, log.data());
        pinfo("SplatPass: shader compile failed (type=%u): %s", type, log.c_str());
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

GLuint linkProgram(GLuint vs, GLuint fs) {
    GLuint program = glCreateProgram();
    if (vs) glAttachShader(program, vs);
    if (fs) glAttachShader(program, fs);
    glLinkProgram(program);

    GLint ok = 0;
    glGetProgramiv(program, GL_LINK_STATUS, &ok);
    if (!ok) {
        GLint logLen = 0;
        glGetProgramiv(program, GL_INFO_LOG_LENGTH, &logLen);
        std::string log(static_cast<size_t>(logLen), '\0');
        glGetProgramInfoLog(program, logLen, nullptr, log.data());
        pinfo("SplatPass: program link failed: %s", log.c_str());
        glDeleteProgram(program);
        return 0;
    }
    if (vs) glDeleteShader(vs);
    if (fs) glDeleteShader(fs);
    return program;
}

GLuint linkComputeProgram(const char *source) {
    GLuint cs = compileShader(GL_COMPUTE_SHADER, source);
    if (!cs) return 0;
    return linkProgram(cs, 0);
}

}  // namespace

VROSplatRenderPass::VROSplatRenderPass(const SplatPassConfig &config)
    : _config(config),
      _buffers(std::make_unique<SplatBuffers>()) {}

VROSplatRenderPass::~VROSplatRenderPass() {
    stopSortWorker();
    if (_programDecode) glDeleteProgram(_programDecode);
    if (_programSort)   glDeleteProgram(_programSort);
    if (_programRaster) glDeleteProgram(_programRaster);
    if (_emptyVAO)      glDeleteVertexArrays(1, &_emptyVAO);
    if (_placeholderTexture) glDeleteTextures(1, &_placeholderTexture);
}

void VROSplatRenderPass::compilePrograms() {
    // Raster pipeline
    GLuint vs = compileShader(GL_VERTEX_SHADER,   SPLAT_VERT_GLSL);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, SPLAT_FRAG_GLSL);
    _programRaster = (vs && fs) ? linkProgram(vs, fs) : kInvalidProgram;

    // Compute sort
    _programSort = linkComputeProgram(SPLAT_SORT_COMP_GLSL);

    // Compute decode (4D temporal evaluation). Even on static 3D
    // sources we use this program — the shader degenerates into a
    // memcpy when timestamp == base-block timestamp.
    _programDecode = linkComputeProgram(SPLAT_DECODE_COMP_GLSL);
}

void VROSplatRenderPass::create1x1PlaceholderTexture() {
    glGenTextures(1, &_placeholderTexture);
    glBindTexture(GL_TEXTURE_2D, _placeholderTexture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    const uint8_t white[] = { 0xFF, 0xFF, 0xFF, 0xFF };
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_UNSIGNED_BYTE, white);
    glBindTexture(GL_TEXTURE_2D, 0);
}

void VROSplatRenderPass::lazyInit() {
    if (_initialized) return;
    compilePrograms();
    glGenVertexArrays(1, &_emptyVAO);
    create1x1PlaceholderTexture();
    _buffers->ensureAllocated(_config.maxSplats);
    detectAndPublishDeviceProfile();
    _initialized = true;
}

namespace {
// Set once on the first lazyInit() — readable from any thread for the
// JNI deviceProfile() call without holding a render-thread lock.
std::atomic<const char*> g_deviceProfileId{ "unknown" };

bool containsCI(const char *haystack, const char *needle) {
    if (!haystack || !needle) return false;
    for (const char *h = haystack; *h; ++h) {
        const char *n = needle;
        const char *t = h;
        while (*n && *t) {
            char a = *t, b = *n;
            if (a >= 'A' && a <= 'Z') a = static_cast<char>(a - 'A' + 'a');
            if (b >= 'A' && b <= 'Z') b = static_cast<char>(b - 'A' + 'a');
            if (a != b) break;
            ++t; ++n;
        }
        if (!*n) return true;
    }
    return false;
}
}  // namespace

void VROSplatRenderPass::detectAndPublishDeviceProfile() {
    const char *renderer = reinterpret_cast<const char *>(glGetString(GL_RENDERER));
    if (!renderer) return;
    // Adreno 740 → Quest 3 / PICO 4 Ultra; older Adreno = Quest 2 class.
    if (containsCI(renderer, "Adreno") && containsCI(renderer, "740")) {
        g_deviceProfileId.store("quest3");
    } else if (containsCI(renderer, "Adreno") && containsCI(renderer, "750")) {
        g_deviceProfileId.store("quest3");
    } else if (containsCI(renderer, "Adreno")) {
        g_deviceProfileId.store("quest2");
    } else if (containsCI(renderer, "Mali")) {
        g_deviceProfileId.store("mali");
    } else if (containsCI(renderer, "PowerVR")) {
        g_deviceProfileId.store("powervr");
    } else {
        g_deviceProfileId.store("unknown");
    }
}

const char *VROSplatRenderPass::detectedDeviceProfileId() {
    return g_deviceProfileId.load();
}

void VROSplatRenderPass::stagePendingSource(
    std::shared_ptr<const std::vector<uint8_t>> bytes,
    GLsizei splatCount)
{
    std::lock_guard<std::mutex> lk(_pendingMutex);
    _pendingSource = std::move(bytes);
    _pendingSplatCount = splatCount;
    // ponytail: cache positions cpu-side so the sort thread doesn't
    // round-trip the SSBO. 16 floats / splat in the staged buffer;
    // pos.xyz lives in the first 3.
    if (_pendingSource && splatCount > 0) {
        const float *src = reinterpret_cast<const float *>(_pendingSource->data());
        _positionsXYZ.resize(static_cast<size_t>(splatCount) * 3);
        for (int i = 0; i < splatCount; ++i) {
            _positionsXYZ[i * 3 + 0] = src[i * 16 + 0];
            _positionsXYZ[i * 3 + 1] = src[i * 16 + 1];
            _positionsXYZ[i * 3 + 2] = src[i * 16 + 2];
        }
        // Seed identity order so the first few frames have a valid
        // sortedIndex before the worker publishes its first sort.
        _sortedIndexUpload.resize(static_cast<size_t>(splatCount));
        for (int i = 0; i < splatCount; ++i) {
            _sortedIndexUpload[i] = static_cast<uint32_t>(i);
        }
        {
            std::lock_guard<std::mutex> pubLk(_publishMutex);
            _sortedIndexPublish = _sortedIndexUpload;
            _publishReady = true;
        }
        startSortWorker();
    }
    pinfo("SplatPass: stagePendingSource  bytes=%zu  splatCount=%d",
          _pendingSource ? _pendingSource->size() : 0,
          static_cast<int>(splatCount));
}

void VROSplatRenderPass::startSortWorker() {
    if (_sortRunning.load()) return;
    _sortRunning.store(true);
    _sortThread = std::thread([this]() { sortWorkerLoop(); });
}

void VROSplatRenderPass::stopSortWorker() {
    if (!_sortRunning.load()) return;
    _sortRunning.store(false);
    _viewCv.notify_all();
    if (_sortThread.joinable()) _sortThread.join();
}

void VROSplatRenderPass::sortWorkerLoop() {
    // mkkellogg/SparkJS-style 16-bit two-pass LSD radix sort. 65 536-bucket
    // resolution gives ~50 µm depth precision in a 3 m scene — orders of
    // magnitude finer than an 8-bit bucket sort, which is the difference
    // between "smooth Gaussian volume" and "muddy z-fighting layers" on a
    // ~500k-splat capture.
    //
    // Layout per iteration:
    //   keys[i]      = uint16 depth-bucket index for splat i
    //   tempIndex[i] = splat index after low-byte (LSB) pass
    //   outIndex[i]  = final sorted order published to the render thread
    //
    // Allocations are reused across iterations; only the first
    // iteration heap-allocates.

    // Lower THIS THREAD's nice level so the render thread never starves
    // even when the sort is pegging a core. Linux extends POSIX so that
    // setpriority(PRIO_PROCESS, tid, ...) targets a single thread when
    // tid comes from gettid() — passing 0 would lower the whole process
    // including the render thread. Failures are non-fatal.
    pid_t tid = static_cast<pid_t>(syscall(SYS_gettid));
    setpriority(PRIO_PROCESS, tid, 5);

    std::vector<uint16_t> keys;
    std::vector<uint32_t> tempIndex;
    std::vector<uint32_t> outIndex;
    constexpr int RADIX = 256;
    uint32_t hist0[RADIX];
    uint32_t hist1[RADIX];
    uint32_t prefix0[RADIX];
    uint32_t prefix1[RADIX];

    while (_sortRunning.load()) {
        // Wait for a view-matrix push (or shutdown).
        std::array<float, 16> view;
        {
            std::unique_lock<std::mutex> lk(_viewMutex);
            _viewCv.wait(lk, [this]() {
                return _hasPendingView || !_sortRunning.load();
            });
            if (!_sortRunning.load()) return;
            view = _pendingView;
            _hasPendingView = false;
        }

        const int n = static_cast<int>(_splatCount.load());
        if (n <= 0 || _positionsXYZ.size() < static_cast<size_t>(n) * 3) {
            continue;
        }

        // Pass A — depth range across all splats. OpenGL convention:
        // negative view-Z is in front; the most-negative depth is the
        // farthest splat. We want farthest first (premultiplied
        // back-to-front), so bucket 0 == minD == farthest.
        const float *pos = _positionsXYZ.data();
        float minD = view[2] * pos[0] + view[6] * pos[1]
                   + view[10] * pos[2] + view[14];
        float maxD = minD;
        for (int i = 1; i < n; ++i) {
            const float d = view[2] * pos[i*3+0] + view[6] * pos[i*3+1]
                          + view[10] * pos[i*3+2] + view[14];
            if (d < minD) minD = d;
            else if (d > maxD) maxD = d;
        }
        const float range = maxD - minD;
        // Quantize into uint16; 65535 leaves headroom on the right edge.
        const float scale = range > 1e-6f ? 65535.0f / range : 0.0f;

        // Pass B — compute keys + low-byte histogram in one loop.
        keys.resize(static_cast<size_t>(n));
        for (int i = 0; i < RADIX; ++i) hist0[i] = 0;
        for (int i = 0; i < n; ++i) {
            const float d = view[2] * pos[i*3+0] + view[6] * pos[i*3+1]
                          + view[10] * pos[i*3+2] + view[14];
            int q = static_cast<int>((d - minD) * scale);
            if (q < 0) q = 0;
            else if (q > 65535) q = 65535;
            keys[i] = static_cast<uint16_t>(q);
            ++hist0[q & 0xFF];
        }

        // Prefix sum → low-byte bucket starts.
        prefix0[0] = 0;
        for (int i = 1; i < RADIX; ++i) prefix0[i] = prefix0[i-1] + hist0[i-1];

        // Pass C — scatter by low byte, also build high-byte histogram of
        // the post-scatter sequence in the same loop (cache-warm read).
        tempIndex.resize(static_cast<size_t>(n));
        for (int i = 0; i < RADIX; ++i) hist1[i] = 0;
        for (int i = 0; i < n; ++i) {
            const uint16_t k = keys[i];
            const uint32_t dst = prefix0[k & 0xFF]++;
            tempIndex[dst] = static_cast<uint32_t>(i);
        }
        // hist1 must reflect the post-scatter order (same multiset, but
        // counting by high byte). We can derive it directly from `keys`
        // since shuffle doesn't change the multiset.
        for (int i = 0; i < n; ++i) ++hist1[(keys[i] >> 8) & 0xFF];

        // Prefix sum → high-byte bucket starts.
        prefix1[0] = 0;
        for (int i = 1; i < RADIX; ++i) prefix1[i] = prefix1[i-1] + hist1[i-1];

        // Pass D — scatter from tempIndex by high byte of each splat's key.
        outIndex.resize(static_cast<size_t>(n));
        for (int i = 0; i < n; ++i) {
            const uint32_t splatId = tempIndex[i];
            const uint16_t k = keys[splatId];
            const uint32_t dst = prefix1[(k >> 8) & 0xFF]++;
            outIndex[dst] = splatId;
        }

        // Publish.
        {
            std::lock_guard<std::mutex> lk(_publishMutex);
            _sortedIndexPublish.swap(outIndex);
            _publishReady = true;
        }
        // Probe: confirm worker is running. First publish + every 60th
        // after. Logs first/last sortedIndex so we can sanity-check the
        // sort produced sensible output (not all-zeros, not identity).
        static std::atomic<int> sPub{0};
        int p = sPub.fetch_add(1, std::memory_order_relaxed);
        if (p == 0 || p % 60 == 0) {
            std::vector<uint32_t> snap;
            {
                std::lock_guard<std::mutex> lk(_publishMutex);
                snap = _sortedIndexPublish;
            }
            const size_t sz = snap.size();
            pinfo("SplatPass: sort-publish #%d  n=%zu  first=[%u,%u,%u]  last=[%u,%u,%u]",
                  p, sz,
                  sz > 0 ? snap[0] : 0u, sz > 1 ? snap[1] : 0u, sz > 2 ? snap[2] : 0u,
                  sz > 2 ? snap[sz-3] : 0u, sz > 1 ? snap[sz-2] : 0u, sz > 0 ? snap[sz-1] : 0u);
        }
    }
}

void VROSplatRenderPass::runDecodePass(VRORenderContext *context) {
    if (!_programDecode) return;
    const float timestamp = _config.getTimestamp ? _config.getTimestamp() : 0.0f;

    glUseProgram(_programDecode);
    GLint locTimestamp = glGetUniformLocation(_programDecode, "u_timestamp");
    GLint locSplatCount = glGetUniformLocation(_programDecode, "u_splatCount");
    glUniform1f(locTimestamp, timestamp);
    glUniform1ui(locSplatCount, static_cast<GLuint>(_splatCount.load()));

    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, _buffers->currentDecodedSplats());

    const GLuint groups = (static_cast<GLuint>(_splatCount.load()) + _config.decodeWorkgroupSize - 1)
                          / _config.decodeWorkgroupSize;
    glDispatchCompute(groups, 1, 1);
    glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT);

    _buffers->advanceDecode();
}

void VROSplatRenderPass::runSortPass(VRORenderContext *context) {
    if (!_programSort) return;

    const VROMatrix4f view = context->getViewMatrix();
    const VROMatrix4f proj = context->getProjectionMatrix();

    glUseProgram(_programSort);
    GLint locView  = glGetUniformLocation(_programSort, "u_view");
    GLint locProj  = glGetUniformLocation(_programSort, "u_proj");
    GLint locCount = glGetUniformLocation(_programSort, "u_splatCount");
    glUniformMatrix4fv(locView, 1, GL_FALSE, view.getArray());
    glUniformMatrix4fv(locProj, 1, GL_FALSE, proj.getArray());
    glUniform1ui(locCount, static_cast<GLuint>(_splatCount.load()));

    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, _buffers->currentDecodedSplats());
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, _buffers->currentSortKeys());
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 2, _buffers->currentIndirectArgs());

    const GLuint groups = (static_cast<GLuint>(_splatCount.load()) + _config.sortWorkgroupSize - 1)
                          / _config.sortWorkgroupSize;
    glDispatchCompute(groups, 1, 1);
    glMemoryBarrier(GL_SHADER_STORAGE_BARRIER_BIT |
                    GL_COMMAND_BARRIER_BIT |
                    GL_VERTEX_ATTRIB_ARRAY_BARRIER_BIT);

    _buffers->advanceSort();
}

void VROSplatRenderPass::runRasterPass(VRORenderContext *context,
                                       VRORenderPassInputOutput &inputs) {
    if (!_programRaster) return;
    const GLuint count = static_cast<GLuint>(_splatCount.load());
    if (count == 0) return;

    const VROMatrix4f view = context->getViewMatrix();
    const VROMatrix4f proj = context->getProjectionMatrix();

    glUseProgram(_programRaster);
    GLint locView = glGetUniformLocation(_programRaster, "u_view");
    GLint locProj = glGetUniformLocation(_programRaster, "u_proj");
    glUniformMatrix4fv(locView, 1, GL_FALSE, view.getArray());
    glUniformMatrix4fv(locProj, 1, GL_FALSE, proj.getArray());

    // Binding 0: decoded splats. Binding 1: sortedIndex (CPU 16-bit radix
    // sort on a worker thread; see sortWorkerLoop + render()).
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, _buffers->currentDecodedSplats());
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, _buffers->currentSortKeys());

    // Indirect draw args: {vertexCount=4, instanceCount=count, first=0, baseInstance=0}.
    // One TRIANGLE_STRIP per instance = one isolated quad per splat
    // (no degenerate-strip connector triangles between splats).
    const GLuint args[4] = { 4u, count, 0u, 0u };
    glBindBuffer(GL_DRAW_INDIRECT_BUFFER, _buffers->currentIndirectArgs());
    glBufferSubData(GL_DRAW_INDIRECT_BUFFER, 0, sizeof(args), args);

    // Splat blend state: premultiplied alpha over opaque, depth-test
    // against opaque writes, do not write depth (splats are
    // transparency-style), no face cull. With the worker sort feeding
    // back-to-front order, smooth Gaussian blending is restored.
    glDisable(GL_CULL_FACE);
    glDepthMask(GL_FALSE);
    glDepthFunc(GL_LEQUAL);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendEquation(GL_FUNC_ADD);
    glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);

    glBindVertexArray(_emptyVAO);
    glDrawArraysIndirect(GL_TRIANGLE_STRIP, nullptr);
    glBindBuffer(GL_DRAW_INDIRECT_BUFFER, 0);
    glBindVertexArray(0);
}

void VROSplatRenderPass::render(std::shared_ptr<VROScene> scene,
                                 std::shared_ptr<VROScene> outgoingScene,
                                 VRORenderPassInputOutput &inputs,
                                 VRORenderContext *context,
                                 std::shared_ptr<VRODriver> &driver) {
    GLStateScope state_scope;

    // ponytail: probe — confirms VROChoreographer is invoking the custom
    // pass at all. Logs once on first call, then every 60th frame so
    // logcat doesn't drown. Remove once splat-test passes end-to-end.
    static std::atomic<int> sFrames{0};
    int n = sFrames.fetch_add(1, std::memory_order_relaxed);
    if (n == 0 || n % 60 == 0) {
        pinfo("SplatPass: render() call #%d  staged=%s  splatCount=%d",
              n,
              _pendingSource ? "yes" : "no",
              static_cast<int>(_splatCount.load()));
    }

    if (!_initialized) lazyInit();

    // #436 guard — bind a known-good 1x1 placeholder on unit 0 so any
    // empty-material code path in subsequent passes can't sample stale
    // texture data. GLStateScope restores the original unit-0 binding.
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, _placeholderTexture);

    // Drain any pending source from the worker-thread decoder.
    {
        std::lock_guard<std::mutex> lk(_pendingMutex);
        if (_pendingSource) {
            glBindBuffer(GL_SHADER_STORAGE_BUFFER, _buffers->currentDecodedSplats());
            glBufferSubData(GL_SHADER_STORAGE_BUFFER, 0,
                            static_cast<GLsizeiptr>(_pendingSource->size()),
                            _pendingSource->data());
            glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);
            _splatCount.store(_pendingSplatCount);
            _pendingSource.reset();
        }
    }

    if (_splatCount.load() <= 0) return;

    // Decode runs at most once per frame (4D timestamp is per-frame, not
    // per-eye). The OpenXR backend calls us once per eye.
    const int frame = context->getFrame();
    if (_config.has4D && frame != _lastDecodedFrame) {
        runDecodePass(context);
        _lastDecodedFrame = frame;
    }

    // Push the LEFT eye view matrix to the sort worker. Skips:
    //   (a) the second eye in the same frame (both eyes share one sort —
    //       IPD-driven order diff is negligible at human viewing distance),
    //   (b) any frame where the view matrix is identical to the last push
    //       (user is stationary — reusing the in-flight or previously
    //       published sort is free and lets the worker idle).
    if (frame != _lastPushedFrame) {
        const VROMatrix4f view = context->getViewMatrix();
        const float *v = view.getArray();
        bool changed = false;
        for (int i = 0; i < 16; ++i) {
            if (_lastPushedView[i] != v[i]) { changed = true; break; }
        }
        if (changed) {
            for (int i = 0; i < 16; ++i) _lastPushedView[i] = v[i];
            {
                std::lock_guard<std::mutex> lk(_viewMutex);
                _pendingView = _lastPushedView;
                _hasPendingView = true;
            }
            _viewCv.notify_one();
        }
        _lastPushedFrame = frame;
    }

    // Pull the most recent sortedIndex published by the worker (if any)
    // and upload to the SSBO. Worker may run at 5-15Hz for huge scenes;
    // render thread reuses the last sortedIndex when none is fresher.
    {
        std::lock_guard<std::mutex> lk(_publishMutex);
        if (_publishReady) {
            _sortedIndexUpload.swap(_sortedIndexPublish);
            _publishReady = false;
        }
    }
    if (!_sortedIndexUpload.empty()) {
        glBindBuffer(GL_SHADER_STORAGE_BUFFER, _buffers->currentSortKeys());
        glBufferSubData(GL_SHADER_STORAGE_BUFFER, 0,
                        static_cast<GLsizeiptr>(_sortedIndexUpload.size() * sizeof(uint32_t)),
                        _sortedIndexUpload.data());
        glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);
    }

    runRasterPass(context, inputs);
}

}  // namespace splat
}  // namespace viroexternal
