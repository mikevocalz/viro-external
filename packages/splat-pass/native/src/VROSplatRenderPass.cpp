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

    const VROMatrix4f view = context->getViewMatrix();
    const VROMatrix4f proj = context->getProjectionMatrix();

    glUseProgram(_programRaster);
    GLint locView  = glGetUniformLocation(_programRaster, "u_view");
    GLint locProj  = glGetUniformLocation(_programRaster, "u_proj");
    glUniformMatrix4fv(locView, 1, GL_FALSE, view.getArray());
    glUniformMatrix4fv(locProj, 1, GL_FALSE, proj.getArray());

    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 0, _buffers->currentDecodedSplats());
    glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, _buffers->currentSortKeys());

    // Splat blend state: premultiplied alpha, depth-test against opaque,
    // do not write depth (splats are transparency-style), no cull.
    glDisable(GL_CULL_FACE);
    glDepthMask(GL_FALSE);
    glDepthFunc(GL_LEQUAL);
    glEnable(GL_DEPTH_TEST);
    glEnable(GL_BLEND);
    glBlendEquation(GL_FUNC_ADD);
    glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);

    glBindVertexArray(_emptyVAO);
    glBindBuffer(GL_DRAW_INDIRECT_BUFFER, _buffers->currentIndirectArgs());
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

    // Sort runs PER EYE — depth-key depends on the eye view matrix.
    runSortPass(context);

    // Raster the splats into the bound HDR target.
    runRasterPass(context, inputs);
}

}  // namespace splat
}  // namespace viroexternal
