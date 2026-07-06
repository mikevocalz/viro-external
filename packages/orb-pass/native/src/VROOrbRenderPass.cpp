// VROOrbRenderPass.cpp
// @viro-external/orb-pass

#include "VROOrbRenderPass.h"

#include "VROLog.h"
#include "VRORenderContext.h"
#include "VROMatrix4f.h"
#include "VROScene.h"
#include "VRONode.h"
#include "VROPortal.h"

#include <atomic>
#include <cmath>
#include <cstring>
#include <chrono>
#include <functional>
#include <map>
#include <vector>

namespace viroexternal {
namespace orb {

namespace {

// ── Core shader — icosphere with ember pulse ─────────────────────────────
constexpr const char *kCoreVertSrc = R"(#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

out vec3 vLocalPos;

void main() {
    vLocalPos = aPos;
    gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
}
)";

// Fragment lifted from ~/orb/src/orb.ts:262-273 (buildCoreMaterial). GLES
// 3.00 — fbm noise → ember mix → HDR boost so it survives Viro tone-map.
constexpr const char *kCoreFragSrc = R"(#version 300 es
precision highp float;
in vec3 vLocalPos;
uniform float uTime;
uniform float uIgnition;
uniform float uBreath;
uniform float uTalk;
out vec4 fragColor;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}
float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; ++i) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
}

void main() {
    vec3 np = vLocalPos * 1.4 + vec3(uTime * 0.25, uTime * 0.18, -uTime * 0.32);
    float churn = fbm(np);
    float pulse = 0.5 + 0.5 * sin(uTime * 1.1 + churn * 6.28);
    float energy = mix(0.4, 1.0, churn) * mix(0.6, 1.3, pulse);
    float talkBoost = 1.0 + uTalk * 0.9;
    vec3 dim   = vec3(0.45, 0.10, 0.06);
    vec3 ember = vec3(0.95, 0.18, 0.10);
    vec3 emit  = mix(dim, ember, smoothstep(0.0, 1.0, uIgnition));
    vec3 rgb   = emit * energy * talkBoost * (0.22 + 0.55 * uIgnition);
    float rim = 1.0 - abs(normalize(vLocalPos).z);
    rgb += ember * pow(rim, 3.0) * 0.4;
    // HDR-boost so Viro's tone-map keeps the ember bright.
    rgb *= 6.0;
    fragColor = vec4(rgb, 1.0);
}
)";

// ── Ring shader — soft-dot glow torus, from orb.ts:82-112 ────────────────
constexpr const char *kRingVertSrc = R"(#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aUv;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uPulseScale;

out vec2 vUv;

void main() {
    vUv = aUv;
    vec3 p = aPos * uPulseScale;
    gl_Position = uProj * uView * uModel * vec4(p, 1.0);
}
)";

constexpr const char *kRingFragSrc = R"(#version 300 es
precision highp float;
in vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uDotCount;
out vec4 fragColor;

void main() {
    float seg = fract(vUv.x * uDotCount);
    float du = abs(seg - 0.5) * 2.0;
    float dv = abs(vUv.y - 0.5) * 2.0;
    float d = sqrt(du * du + dv * dv);
    float core = 1.0 - smoothstep(0.0, 0.55, d);
    float halo = 1.0 - smoothstep(0.4, 1.0, d);
    float a = core + halo * 0.35;
    if (a < 0.01) discard;
    // Additive blending expects premultiplied RGB. HDR boost + intensity.
    fragColor = vec4(uColor * uIntensity * a * 5.0, a * 0.95);
}
)";

// ── Force shield — fresnel containment bubble, port of orb.ts shell
// (SHELL_TRANSFORM ripple) + drag wake. Sits between core and rings.
constexpr const char *kShieldVertSrc = R"(#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;
uniform float uBreath;
uniform float uTalk;
uniform float uSpeed;
uniform vec3 uVelDir;
out vec3 vN;
out vec3 vW;
void main() {
    vec3 radial = normalize(aPos);
    float pulse = uBreath * 0.05
                + uTalk * 0.12 * sin(uTime * 6.0 + length(aPos) * 9.0 + aPos.y * 4.0);
    vec3 p = aPos * (1.0 + pulse);
    vec4 w = uModel * vec4(p, 1.0);
    vec3 nW = normalize(mat3(uModel) * radial);
    float trail = max(0.0, dot(nW, -uVelDir));
    w.xyz -= uVelDir * (uSpeed * 0.10) * trail;
    vN = nW;
    vW = w.xyz;
    gl_Position = uProj * uView * w;
}
)";

constexpr const char *kShieldFragSrc = R"(#version 300 es
precision highp float;
in vec3 vN;
in vec3 vW;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uIgnition;
uniform float uTalk;
uniform float uSpeed;
out vec4 fragColor;
float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}
float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; ++i) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
}
void main() {
    vec3 V = normalize(uCamPos - vW);
    float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.2);
    float shimmer = fbm(vW * 5.0 + vec3(0.0, uTime * 0.35, uTime * 0.2));
    float a = fres * (0.30 + 0.55 * uTalk + min(uSpeed * 0.8, 0.6))
                   * (0.55 + 0.45 * shimmer) * uIgnition;
    vec3 col = mix(vec3(1.0, 0.20, 0.16), vec3(1.0, 0.55, 0.45), shimmer);
    fragColor = vec4(col * a * 5.0, a);
}
)";

// ── Particles — attribute-less GL_POINTS orbiting between core and shield.
// Orbits are pure functions of gl_VertexID + time; drag velocity streams
// them opposite the motion with per-particle lag.
constexpr const char *kPointVertSrc = R"(#version 300 es
precision highp float;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;
uniform float uTalk;
uniform float uSpeed;
uniform vec3 uVelDir;
out float vSeed;
float h(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
    float id = float(gl_VertexID);
    float h1 = h(id * 1.3), h2 = h(id * 2.7), h3 = h(id * 4.1), h4 = h(id * 7.9);
    float r   = mix(1.04, 1.22, h1);
    float spd = mix(0.15, 0.6, h2) * (h3 > 0.5 ? 1.0 : -1.0);
    float th  = h2 * 6.2831853 + uTime * spd;
    float ph  = acos(2.0 * h3 - 1.0) + sin(uTime * (0.3 + h4 * 0.5)) * 0.35;
    vec3 p = r * vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
    vec4 w = uModel * vec4(p, 1.0);
    w.xyz -= uVelDir * uSpeed * (0.05 + 0.20 * h4);
    vSeed = id;
    gl_Position = uProj * uView * w;
    float dist = max(gl_Position.w, 0.2);
    gl_PointSize = clamp((2.0 + 4.0 * h1) * (1.0 + uTalk * 1.2) * (2.0 / dist), 1.5, 10.0);
}
)";

constexpr const char *kPointFragSrc = R"(#version 300 es
precision highp float;
in float vSeed;
uniform float uTime;
uniform float uIgnition;
out vec4 fragColor;
void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float sparkle = 0.35 + 0.65 * fract(sin(vSeed * 3.7 + uTime * 2.0) * 7.13);
    float a = (1.0 - smoothstep(0.4, 1.0, d)) * sparkle * uIgnition;
    if (a < 0.01) discard;
    vec3 col = mix(vec3(1.0, 0.30, 0.20), vec3(1.0, 0.80, 0.70), fract(vSeed * 0.618));
    fragColor = vec4(col * a * 4.0, a);
}
)";

GLuint compileShader(GLenum type, const char *src) {
    GLuint s = glCreateShader(type);
    glShaderSource(s, 1, &src, nullptr);
    glCompileShader(s);
    GLint ok = 0;
    glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[1024]; GLsizei len = 0;
        glGetShaderInfoLog(s, sizeof(log), &len, log);
        pinfo("OrbPass: shader compile failed (type=%u): %s", type, log);
        glDeleteShader(s);
        return 0;
    }
    return s;
}

GLuint linkProgram(GLuint vs, GLuint fs) {
    GLuint p = glCreateProgram();
    glAttachShader(p, vs); glAttachShader(p, fs);
    glLinkProgram(p);
    GLint ok = 0;
    glGetProgramiv(p, GL_LINK_STATUS, &ok);
    if (!ok) {
        char log[1024]; GLsizei len = 0;
        glGetProgramInfoLog(p, sizeof(log), &len, log);
        pinfo("OrbPass: program link failed: %s", log);
        glDeleteProgram(p);
        return 0;
    }
    glDeleteShader(vs); glDeleteShader(fs);
    return p;
}

// ── Icosphere (subdivided once — 42 verts, 80 faces) ─────────────────────
struct IcosphereGen {
    struct Tri { GLuint a, b, c; };
    std::vector<float> verts;
    std::vector<GLuint> idx;
    IcosphereGen() {
        constexpr float t = 1.6180339887498949f;
        const float scaleInv = 1.0f / std::sqrt(1.0f + t * t);
        float base[12][3] = {
            {-1,  t,  0}, { 1,  t,  0}, {-1, -t,  0}, { 1, -t,  0},
            { 0, -1,  t}, { 0,  1,  t}, { 0, -1, -t}, { 0,  1, -t},
            { t,  0, -1}, { t,  0,  1}, {-t,  0, -1}, {-t,  0,  1},
        };
        for (auto &v : base) {
            verts.push_back(v[0] * scaleInv);
            verts.push_back(v[1] * scaleInv);
            verts.push_back(v[2] * scaleInv);
        }
        Tri baseIdx[20] = {
            {0,11,5},{0,5,1},{0,1,7},{0,7,10},{0,10,11},
            {1,5,9},{5,11,4},{11,10,2},{10,7,6},{7,1,8},
            {3,9,4},{3,4,2},{3,2,6},{3,6,8},{3,8,9},
            {4,9,5},{2,4,11},{6,2,10},{8,6,7},{9,8,1},
        };
        std::map<uint64_t, GLuint> midCache;
        auto midpoint = [&](GLuint a, GLuint b) -> GLuint {
            uint64_t k = (uint64_t)std::min(a, b) << 32 | std::max(a, b);
            auto it = midCache.find(k);
            if (it != midCache.end()) return it->second;
            float mx = 0.5f * (verts[a*3+0] + verts[b*3+0]);
            float my = 0.5f * (verts[a*3+1] + verts[b*3+1]);
            float mz = 0.5f * (verts[a*3+2] + verts[b*3+2]);
            float len = std::sqrt(mx*mx + my*my + mz*mz);
            mx /= len; my /= len; mz /= len;
            GLuint newIdx = (GLuint)(verts.size() / 3);
            verts.push_back(mx); verts.push_back(my); verts.push_back(mz);
            midCache[k] = newIdx;
            return newIdx;
        };
        for (auto &tr : baseIdx) {
            GLuint m1 = midpoint(tr.a, tr.b);
            GLuint m2 = midpoint(tr.b, tr.c);
            GLuint m3 = midpoint(tr.c, tr.a);
            idx.push_back(tr.a); idx.push_back(m1); idx.push_back(m3);
            idx.push_back(tr.b); idx.push_back(m2); idx.push_back(m1);
            idx.push_back(tr.c); idx.push_back(m3); idx.push_back(m2);
            idx.push_back(m1);   idx.push_back(m2); idx.push_back(m3);
        }
    }
};

// ── Torus (unit-ring, unit-tube — scaled per-instance by uModel) ─────────
// Interleaved pos(3) + uv(2). UV.x sweeps around the ring, UV.y around the
// tube — same as three.js TorusGeometry, so the soft-dot fragment reads
// correctly.
struct TorusGen {
    std::vector<float> verts;   // 5 floats per vertex
    std::vector<GLuint> idx;
    TorusGen(int ringSegs, int tubeSegs, float ringR, float tubeR) {
        for (int j = 0; j <= tubeSegs; ++j) {
            float v = (float)j / (float)tubeSegs;
            float phi = v * 2.0f * (float)M_PI;
            for (int i = 0; i <= ringSegs; ++i) {
                float u = (float)i / (float)ringSegs;
                float theta = u * 2.0f * (float)M_PI;
                float x = (ringR + tubeR * std::cos(phi)) * std::cos(theta);
                float y = (ringR + tubeR * std::cos(phi)) * std::sin(theta);
                float z = tubeR * std::sin(phi);
                verts.push_back(x);
                verts.push_back(y);
                verts.push_back(z);
                verts.push_back(u);
                verts.push_back(v);
            }
        }
        int stride = ringSegs + 1;
        for (int j = 0; j < tubeSegs; ++j) {
            for (int i = 0; i < ringSegs; ++i) {
                GLuint a = j * stride + i;
                GLuint b = (j + 1) * stride + i;
                GLuint c = (j + 1) * stride + i + 1;
                GLuint d = j * stride + i + 1;
                idx.push_back(a); idx.push_back(b); idx.push_back(d);
                idx.push_back(b); idx.push_back(c); idx.push_back(d);
            }
        }
    }
};

// ── Small matrix helpers (column-major) ──────────────────────────────────
void mat4Identity(float m[16]) {
    for (int i = 0; i < 16; ++i) m[i] = 0.0f;
    m[0] = m[5] = m[10] = m[15] = 1.0f;
}
void mat4Translate(float m[16], float tx, float ty, float tz) {
    m[12] = tx; m[13] = ty; m[14] = tz;
}
void mat4Scale(float m[16], float sx, float sy, float sz) {
    m[0] *= sx; m[1] *= sx; m[2] *= sx;
    m[4] *= sy; m[5] *= sy; m[6] *= sy;
    m[8] *= sz; m[9] *= sz; m[10] *= sz;
}
// Rotate around arbitrary axis in-place. Axis assumed normalized.
void mat4RotateAxis(float m[16], float x, float y, float z, float angle) {
    float c = std::cos(angle), s = std::sin(angle), ic = 1.0f - c;
    float r[16] = {
        c + x*x*ic,   y*x*ic + z*s, z*x*ic - y*s, 0,
        x*y*ic - z*s, c + y*y*ic,   z*y*ic + x*s, 0,
        x*z*ic + y*s, y*z*ic - x*s, c + z*z*ic,   0,
        0, 0, 0, 1,
    };
    float out[16];
    for (int col = 0; col < 4; ++col) {
        for (int row = 0; row < 4; ++row) {
            float sum = 0.0f;
            for (int k = 0; k < 4; ++k) {
                sum += m[k * 4 + row] * r[col * 4 + k];
            }
            out[col * 4 + row] = sum;
        }
    }
    std::memcpy(m, out, sizeof(out));
}

}  // namespace

VROOrbRenderPass::VROOrbRenderPass() = default;

void VROOrbRenderPass::setTalkTarget(float value) {
    if (value < 0.0f) value = 0.0f;
    if (value > 1.0f) value = 1.0f;
    _talkTarget.store(value, std::memory_order_relaxed);
}

void VROOrbRenderPass::setIgnitionTarget(float value) {
    if (value < 0.0f) value = 0.0f;
    if (value > 1.0f) value = 1.0f;
    _ignitionTarget.store(value, std::memory_order_relaxed);
}

void VROOrbRenderPass::setBreathOverride(float value) {
    _breathOverride.store(value, std::memory_order_relaxed);
}

void VROOrbRenderPass::setListenTarget(float value) {
    if (value < 0) value = 0; if (value > 1) value = 1;
    _listenTarget.store(value, std::memory_order_relaxed);
}

void VROOrbRenderPass::setWorldPosition(float x, float y, float z) {
    if (std::isnan(x)) {
        // Summon: back to head-follow; re-pin after the follow window.
        _instFrames = 0;
        _worldX.store(x, std::memory_order_relaxed);
        return;
    }
    _worldY.store(y, std::memory_order_relaxed);
    _worldZ.store(z, std::memory_order_relaxed);
    // X last so a render thread that reads X first and sees non-NaN also
    // gets fresh Y/Z. Not strict guarantee — good enough for drag.
    _worldX.store(x, std::memory_order_relaxed);
}

namespace {
// Critically-damped spring — same shape as orb.ts:429 spring(state, target, k, d, dt).
void springStep(float &value, float &vel, float target, float k, float d, float dt) {
    float ax = -k * (value - target) - d * vel;
    vel += ax * dt;
    value += vel * dt;
}
}


VROOrbRenderPass::~VROOrbRenderPass() {
    if (_coreProgram) glDeleteProgram(_coreProgram);
    if (_ringProgram) glDeleteProgram(_ringProgram);
    if (_coreIbo) glDeleteBuffers(1, &_coreIbo);
    if (_coreVbo) glDeleteBuffers(1, &_coreVbo);
    if (_coreVao) glDeleteVertexArrays(1, &_coreVao);
    if (_ringIbo) glDeleteBuffers(1, &_ringIbo);
    if (_ringVbo) glDeleteBuffers(1, &_ringVbo);
    if (_ringVao) glDeleteVertexArrays(1, &_ringVao);
    if (_shieldProgram) glDeleteProgram(_shieldProgram);
    if (_pointProgram) glDeleteProgram(_pointProgram);
    if (_pointVao) glDeleteVertexArrays(1, &_pointVao);
}

void VROOrbRenderPass::buildShieldProgram() {
    GLuint vs = compileShader(GL_VERTEX_SHADER, kShieldVertSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, kShieldFragSrc);
    _shieldProgram = (vs && fs) ? linkProgram(vs, fs) : 0;
    if (!_shieldProgram) return;
    _uShModel    = glGetUniformLocation(_shieldProgram, "uModel");
    _uShView     = glGetUniformLocation(_shieldProgram, "uView");
    _uShProj     = glGetUniformLocation(_shieldProgram, "uProj");
    _uShTime     = glGetUniformLocation(_shieldProgram, "uTime");
    _uShIgnition = glGetUniformLocation(_shieldProgram, "uIgnition");
    _uShBreath   = glGetUniformLocation(_shieldProgram, "uBreath");
    _uShTalk     = glGetUniformLocation(_shieldProgram, "uTalk");
    _uShSpeed    = glGetUniformLocation(_shieldProgram, "uSpeed");
    _uShVelDir   = glGetUniformLocation(_shieldProgram, "uVelDir");
    _uShCamPos   = glGetUniformLocation(_shieldProgram, "uCamPos");
}

void VROOrbRenderPass::buildPointProgram() {
    GLuint vs = compileShader(GL_VERTEX_SHADER, kPointVertSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, kPointFragSrc);
    _pointProgram = (vs && fs) ? linkProgram(vs, fs) : 0;
    if (!_pointProgram) return;
    _uPtModel    = glGetUniformLocation(_pointProgram, "uModel");
    _uPtView     = glGetUniformLocation(_pointProgram, "uView");
    _uPtProj     = glGetUniformLocation(_pointProgram, "uProj");
    _uPtTime     = glGetUniformLocation(_pointProgram, "uTime");
    _uPtIgnition = glGetUniformLocation(_pointProgram, "uIgnition");
    _uPtTalk     = glGetUniformLocation(_pointProgram, "uTalk");
    _uPtSpeed    = glGetUniformLocation(_pointProgram, "uSpeed");
    _uPtVelDir   = glGetUniformLocation(_pointProgram, "uVelDir");
    glGenVertexArrays(1, &_pointVao);   // attribute-less; GLES3 still needs a VAO
}

void VROOrbRenderPass::buildCoreProgram() {
    GLuint vs = compileShader(GL_VERTEX_SHADER, kCoreVertSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, kCoreFragSrc);
    _coreProgram = (vs && fs) ? linkProgram(vs, fs) : 0;
    if (!_coreProgram) return;
    _uCoreModel    = glGetUniformLocation(_coreProgram, "uModel");
    _uCoreView     = glGetUniformLocation(_coreProgram, "uView");
    _uCoreProj     = glGetUniformLocation(_coreProgram, "uProj");
    _uCoreTime     = glGetUniformLocation(_coreProgram, "uTime");
    _uCoreIgnition = glGetUniformLocation(_coreProgram, "uIgnition");
    _uCoreBreath   = glGetUniformLocation(_coreProgram, "uBreath");
    _uCoreTalk     = glGetUniformLocation(_coreProgram, "uTalk");
}

void VROOrbRenderPass::buildRingProgram() {
    GLuint vs = compileShader(GL_VERTEX_SHADER, kRingVertSrc);
    GLuint fs = compileShader(GL_FRAGMENT_SHADER, kRingFragSrc);
    _ringProgram = (vs && fs) ? linkProgram(vs, fs) : 0;
    if (!_ringProgram) return;
    _uRingModel      = glGetUniformLocation(_ringProgram, "uModel");
    _uRingView       = glGetUniformLocation(_ringProgram, "uView");
    _uRingProj       = glGetUniformLocation(_ringProgram, "uProj");
    _uRingColor      = glGetUniformLocation(_ringProgram, "uColor");
    _uRingIntensity  = glGetUniformLocation(_ringProgram, "uIntensity");
    _uRingDotCount   = glGetUniformLocation(_ringProgram, "uDotCount");
    _uRingPulseScale = glGetUniformLocation(_ringProgram, "uPulseScale");
}

void VROOrbRenderPass::buildCoreVBO() {
    IcosphereGen g;
    _coreIndexCount = static_cast<GLsizei>(g.idx.size());
    glGenVertexArrays(1, &_coreVao);
    glBindVertexArray(_coreVao);
    glGenBuffers(1, &_coreVbo);
    glBindBuffer(GL_ARRAY_BUFFER, _coreVbo);
    glBufferData(GL_ARRAY_BUFFER, g.verts.size() * sizeof(float), g.verts.data(), GL_STATIC_DRAW);
    glGenBuffers(1, &_coreIbo);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, _coreIbo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, g.idx.size() * sizeof(GLuint), g.idx.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(float) * 3, nullptr);
    glBindVertexArray(0);
}

void VROOrbRenderPass::buildRingVBO() {
    // Single unit-ring torus geometry — reused for all 3 rings with different
    // uModel (radius + rotation baked in) and uColor / uDotCount. Ring geometry
    // uses ringR = 1.0, tubeR = 1.0. uModel scales those into per-ring size.
    // ringR=1, tubeR=0.02 — thin tube, uniform-scaled by rc.r × kOrbScale.
    TorusGen g(16, 128, 1.0f, 0.02f);
    _ringIndexCount = static_cast<GLsizei>(g.idx.size());
    glGenVertexArrays(1, &_ringVao);
    glBindVertexArray(_ringVao);
    glGenBuffers(1, &_ringVbo);
    glBindBuffer(GL_ARRAY_BUFFER, _ringVbo);
    glBufferData(GL_ARRAY_BUFFER, g.verts.size() * sizeof(float), g.verts.data(), GL_STATIC_DRAW);
    glGenBuffers(1, &_ringIbo);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, _ringIbo);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, g.idx.size() * sizeof(GLuint), g.idx.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(float) * 5, nullptr);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, sizeof(float) * 5,
                           (const void*)(sizeof(float) * 3));
    glBindVertexArray(0);
}

void VROOrbRenderPass::lazyInit() {
    buildCoreProgram();
    buildRingProgram();
    buildCoreVBO();
    buildRingVBO();
    buildShieldProgram();
    buildPointProgram();
    _initialized = true;
    pinfo("OrbPass: init coreProg=%u ringProg=%u coreIdx=%d ringIdx=%d",
          _coreProgram, _ringProgram, _coreIndexCount, _ringIndexCount);
}

// Per-ring config — mirrors ~/orb/src/orb.ts:321-329.
struct RingConfig {
    float r;         // torus radius (× orb scale)
    float tube;      // tube radius (× orb scale)
    float dots;
    float initTiltX, initTiltY, initTiltZ;
    float spin;      // signed radians/sec around local Z
    float color[3];
};

static const RingConfig kRings[3] = {
    { 1.35f, 0.030f, 36.0f, 0,             0,             0,             0.55f,
      { 1.0f, 0.19f, 0.25f } },   // 0xff3040 deep red
    { 1.50f, 0.024f, 48.0f, (float)(M_PI/2.4), (float)(M_PI/6), 0, -0.38f,
      { 1.0f, 0.31f, 0.38f } },   // 0xff5060 mid red
    { 1.65f, 0.020f, 60.0f, (float)(-M_PI/3), (float)(M_PI/2.2), 0, 0.72f,
      { 1.0f, 0.47f, 0.53f } },   // 0xff7888 light red
};

void VROOrbRenderPass::render(std::shared_ptr<VROScene> scene,
                               std::shared_ptr<VROScene> outgoingScene,
                               VRORenderPassInputOutput &inputs,
                               VRORenderContext *context,
                               std::shared_ptr<VRODriver> &driver) {
    if (!_initialized) lazyInit();
    if (!_coreProgram || !_ringProgram) return;

    static std::atomic<int> sFrames{0};
    int n = sFrames.fetch_add(1, std::memory_order_relaxed);
    if (n == 0 || n % 3600 == 0) {
        pinfo("OrbPass: render() #%d eye=%d frame=%d",
              n, (int)context->getEyeType(), context->getFrame());
    }

    // ── Save state ────────────────────────────────────────────────────────
    GLboolean prevDepthMask;   glGetBooleanv(GL_DEPTH_WRITEMASK, &prevDepthMask);
    GLint prevDepthFunc;       glGetIntegerv(GL_DEPTH_FUNC, &prevDepthFunc);
    GLint prevProgram;         glGetIntegerv(GL_CURRENT_PROGRAM, &prevProgram);
    GLint prevVAO;             glGetIntegerv(GL_VERTEX_ARRAY_BINDING, &prevVAO);
    GLboolean prevCullFace = glIsEnabled(GL_CULL_FACE);
    GLboolean prevBlend    = glIsEnabled(GL_BLEND);
    GLint prevBlendSrcRGB;     glGetIntegerv(GL_BLEND_SRC_RGB,   &prevBlendSrcRGB);
    GLint prevBlendDstRGB;     glGetIntegerv(GL_BLEND_DST_RGB,   &prevBlendDstRGB);
    GLint prevBlendSrcAlpha;   glGetIntegerv(GL_BLEND_SRC_ALPHA, &prevBlendSrcAlpha);
    GLint prevBlendDstAlpha;   glGetIntegerv(GL_BLEND_DST_ALPHA, &prevBlendDstAlpha);

    // ── Common uniforms per frame ────────────────────────────────────────
    VROMatrix4f view = context->getViewMatrix();
    VROMatrix4f proj = context->getProjectionMatrix();

    // Time (rolling seconds since first render).
    static const auto t0 = std::chrono::steady_clock::now();
    float t = std::chrono::duration<float>(
                  std::chrono::steady_clock::now() - t0).count();

    // Reactive uniforms — spring toward atomics that JS sets from any
    // thread. Springs run on render thread only; dt is derived from t
    // between calls. First frame: dt = 0, no motion.
    double dt = (_lastRenderSec < 0) ? 0.0 : (t - _lastRenderSec);
    _lastRenderSec = t;
    if (dt > 0.05) dt = 0.05;  // clamp to avoid explosive spring after a stall
    float talkTarget    = _talkTarget.load(std::memory_order_relaxed);
    float ignitionTarget = _ignitionTarget.load(std::memory_order_relaxed);
    // Envelope follower, not a spring — RMS targets arrive in bursts from a
    // busy JS thread; a spring wobbles chasing them. Fast attack, slow release.
    {
        float tau = talkTarget > _talkValue ? 0.12f : 0.50f;
        float ka = 1.0f - expf((float)(-dt / tau));
        _talkValue += (talkTarget - _talkValue) * ka;
        // Slow layer for scale: swells while she speaks, ignores syllables.
        float ks = 1.0f - expf((float)(-dt / 0.45f));
        _talkSlow += (_talkValue - _talkSlow) * ks;
    }
    springStep(_ignitionValue, _ignitionVel, ignitionTarget, 60.0f, 14.0f, (float)dt);
    float talk   = _talkValue;
    float ignite = _ignitionValue;
    {
        float lt = _listenTarget.load(std::memory_order_relaxed);
        float kl = 1.0f - expf((float)(-dt / 0.25f));
        _listenValue += (lt - _listenValue) * kl;
    }
    float listen = _listenValue;

    // Breath — auto-sine baseline + micro-noise + talk-pulse (from
    // ~/orb/src/orb.ts:423-427). JS can override via setBreathOverride.
    float breathOverride = _breathOverride.load(std::memory_order_relaxed);
    float breath;
    if (breathOverride >= 0.0f) {
        breath = breathOverride;
    } else {
        // Listening: breath quickens (1.2 → ~2.1 Hz) and micro-motion doubles —
        // reads as attentive without competing with the talk pump.
        float breathRate = 1.2f + listen * 0.9f;
        float baseBreath = std::sin(t * breathRate) * 0.5f;
        float micro = std::sin(t * 7.3f + std::cos(t * 0.7f) * 2.1f) * (0.06f + 0.06f * listen);
        float talkPulseRate = 6.0f + talk * 6.0f;
        float talkPulse = std::sin(t * talkPulseRate) * talk * 0.6f;
        breath = baseBreath + micro + talkPulse;
    }

    // ── Core sphere ──────────────────────────────────────────────────────
    glDepthFunc(GL_ALWAYS);
    glDepthMask(GL_FALSE);
    glDisable(GL_CULL_FACE);
    glDisable(GL_BLEND);

    // Anchor priority 1: a scene node tagged "orb-anchor" (the drag proxy).
    // Native per-frame glue — dragging the proxy drags the orb at 90 fps.
    std::shared_ptr<VRONode> anchor = _anchorNode.lock();
    if (!anchor && scene && --_anchorSearchCountdown <= 0) {
        _anchorSearchCountdown = 60; // re-search ~2x/sec until found
        std::function<std::shared_ptr<VRONode>(const std::shared_ptr<VRONode>&)> find =
            [&](const std::shared_ptr<VRONode> &n) -> std::shared_ptr<VRONode> {
                if (n->getTag() == "orb-anchor") return n;
                for (const auto &ch : n->getChildNodes()) {
                    auto r = find(ch);
                    if (r) return r;
                }
                return nullptr;
            };
        anchor = find(scene->getRootNode());
        if (anchor) {
            _anchorNode = anchor;
            pinfo("OrbPass: glued to scene anchor node");
        }
    }
    if (anchor) {
        VROVector3f p = anchor->getWorldPosition();
        float gax = p.x, gay = p.y, gaz = p.z;
        // Glide and render from the node anchor; skip world/head logic.
        // Anchor node is already tremor-filtered natively — glue 1:1, any
        // second filter here only adds lag.
        _smoothX = gax; _smoothY = gay; _smoothZ = gaz; _smoothInit = true;
    }

    // Anchor selection: if JS has called setWorldPosition, use it. Otherwise
    // SELF-PIN: once tracking has settled (~0.5 s / 30 dispatches), place the
    // orb 1.8 m in front of the current gaze and freeze that WORLD position —
    // it must not follow the head afterwards. Until pinned, it tracks the
    // head so it's visible from the first frame.
    float ax, ay, az;
    float worldX = _worldX.load(std::memory_order_relaxed);
    if (!std::isnan(worldX)) {
        ax = worldX;
        ay = _worldY.load(std::memory_order_relaxed);
        az = _worldZ.load(std::memory_order_relaxed);
    } else {
        VROMatrix4f eyeToWorld = view.invert();
        const float *e = eyeToWorld.getArray();
        float fx = -e[8], fy = -e[9], fz = -e[10];
        ax = e[12] + fx * 1.8f;
        ay = e[13] + fy * 1.8f - 0.15f;
        az = e[14] + fz * 1.8f;
        if (++_instFrames >= 30) {   // per-instance: wait for THIS session's tracking
            setWorldPosition(ax, ay, az);
            pinfo("OrbPass: self-pinned at (%.2f, %.2f, %.2f)", ax, ay, az);
        }
    }

    // Glide the rendered anchor toward the target — kills teleports from
    // pin/summon/drag updates. ~120ms time constant. (When a scene anchor is
    // glued above, its glide already ran — this pass-through keeps it.)
    if (!anchor) {
        if (!_smoothInit) {
            _smoothX = ax; _smoothY = ay; _smoothZ = az;
            _smoothInit = true;
        } else {
            float k = 1.0f - std::exp((float)(-dt * 8.0));
            _smoothX += (ax - _smoothX) * k;
            _smoothY += (ay - _smoothY) * k;
            _smoothZ += (az - _smoothZ) * k;
        }
    }
    ax = _smoothX; ay = _smoothY; az = _smoothZ;

    // Core model: scale + translate to head-relative anchor.
    float coreModel[16];
    mat4Identity(coreModel);
    // Animations must be physical, not just emissive — the HDR-boosted core
    // is saturated, so brightness modulation alone doesn't read.
    // Reveal: grow in with ignition. Idle: breath sways scale. Talk: pump.
    float animScale = kOrbScale * (0.55f + 0.45f * ignite)
                               * (1.0f + 0.03f * breath + 0.10f * _talkSlow);
    mat4Scale(coreModel, animScale, animScale, animScale);
    mat4Translate(coreModel, ax, ay, az);

    glUseProgram(_coreProgram);
    glUniformMatrix4fv(_uCoreModel, 1, GL_FALSE, coreModel);
    glUniformMatrix4fv(_uCoreView,  1, GL_FALSE, view.getArray());
    glUniformMatrix4fv(_uCoreProj,  1, GL_FALSE, proj.getArray());
    glUniform1f(_uCoreTime, t);
    glUniform1f(_uCoreIgnition, ignite);
    glUniform1f(_uCoreBreath, breath);
    glUniform1f(_uCoreTalk, talk);
    glBindVertexArray(_coreVao);
    glDrawElements(GL_TRIANGLES, _coreIndexCount, GL_UNSIGNED_INT, nullptr);

    // ── Anchor velocity (world units/s, smoothed) — drives shield wake +
    // particle streaming while the orb is dragged. dt≈0 on the second eye
    // of a frame; skip those so velocity is computed once per frame.
    if (dt > 0.0005) {
        if (!_velInit) {
            _velInit = true;
            _pAX = ax; _pAY = ay; _pAZ = az;
        } else {
            float vx = (ax - _pAX) / (float)dt;
            float vy = (ay - _pAY) / (float)dt;
            float vz = (az - _pAZ) / (float)dt;
            float kv = 1.0f - expf((float)(-dt * 10.0));
            _velX += (vx - _velX) * kv;
            _velY += (vy - _velY) * kv;
            _velZ += (vz - _velZ) * kv;
            _pAX = ax; _pAY = ay; _pAZ = az;
        }
    }
    float speed = sqrtf(_velX*_velX + _velY*_velY + _velZ*_velZ);
    if (speed > 3.0f) speed = 3.0f;
    float inv = speed > 1e-4f ? 1.0f / speed : 0.0f;
    float vdx = _velX * inv, vdy = _velY * inv, vdz = _velZ * inv;
    VROVector3f camPos = context->getCamera().getPosition();

    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE);   // additive

    // ── Force shield (fresnel bubble at 1.22× core) ──────────────────────
    if (_shieldProgram) {
        float shieldModel[16];
        mat4Identity(shieldModel);
        float ss = animScale * 1.22f;
        mat4Scale(shieldModel, ss, ss, ss);
        mat4Translate(shieldModel, ax, ay, az);
        glUseProgram(_shieldProgram);
        glUniformMatrix4fv(_uShModel, 1, GL_FALSE, shieldModel);
        glUniformMatrix4fv(_uShView,  1, GL_FALSE, view.getArray());
        glUniformMatrix4fv(_uShProj,  1, GL_FALSE, proj.getArray());
        glUniform1f(_uShTime, t);
        glUniform1f(_uShIgnition, ignite);
        glUniform1f(_uShBreath, breath);
        glUniform1f(_uShTalk, talk + listen * 0.35f * (1.0f - talk));
        glUniform1f(_uShSpeed, speed);
        glUniform3f(_uShVelDir, vdx, vdy, vdz);
        glUniform3f(_uShCamPos, camPos.x, camPos.y, camPos.z);
        glBindVertexArray(_coreVao);
        glDrawElements(GL_TRIANGLES, _coreIndexCount, GL_UNSIGNED_INT, nullptr);
    }

    // ── Particles (between core and shield) ──────────────────────────────
    if (_pointProgram) {
        float ptModel[16];
        mat4Identity(ptModel);
        mat4Scale(ptModel, animScale, animScale, animScale);
        mat4Translate(ptModel, ax, ay, az);
        glUseProgram(_pointProgram);
        glUniformMatrix4fv(_uPtModel, 1, GL_FALSE, ptModel);
        glUniformMatrix4fv(_uPtView,  1, GL_FALSE, view.getArray());
        glUniformMatrix4fv(_uPtProj,  1, GL_FALSE, proj.getArray());
        glUniform1f(_uPtTime, t);
        glUniform1f(_uPtIgnition, ignite);
        glUniform1f(_uPtTalk, talk);
        glUniform1f(_uPtSpeed, speed);
        glUniform3f(_uPtVelDir, vdx, vdy, vdz);
        glBindVertexArray(_pointVao);
        glDrawArrays(GL_POINTS, 0, 384);
    }

    // ── Rings (additive) ─────────────────────────────────────────────────
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE);   // additive
    glUseProgram(_ringProgram);
    glUniformMatrix4fv(_uRingView, 1, GL_FALSE, view.getArray());
    glUniformMatrix4fv(_uRingProj, 1, GL_FALSE, proj.getArray());
    glUniform1f(_uRingPulseScale, (0.55f + 0.45f * ignite) * (1.0f + breath * 0.06f + talk * 0.10f));
    glUniform1f(_uRingIntensity, (0.25f + 0.65f * ignite) * (0.9f + talk * 1.4f + listen * 0.35f));
    glBindVertexArray(_ringVao);

    for (int i = 0; i < 3; ++i) {
        const RingConfig &rc = kRings[i];

        // Uniform scale — VBO is unit-ring unit-tube, so scaling uniformly
        // by (kOrbScale * rc.r) produces a ring of that radius with tube =
        // kOrbScale * rc.r × 1.0 = same as radius. That's too fat. So the
        // VBO instead uses tubeR = 0.02 baked in; here we uniform-scale
        // only by rc.r × kOrbScale and let tube ride along. Tube ends up
        // slightly proportional-to-ring but visually reads as rings.
        float model[16];
        mat4Identity(model);
        mat4Scale(model, rc.r * kOrbScale, rc.r * kOrbScale, rc.r * kOrbScale);
        if (rc.initTiltX != 0.0f) mat4RotateAxis(model, 1, 0, 0, rc.initTiltX);
        if (rc.initTiltY != 0.0f) mat4RotateAxis(model, 0, 1, 0, rc.initTiltY);
        mat4RotateAxis(model, 0, 0, 1, rc.spin * t);
        mat4Translate(model, ax, ay, az);

        glUniformMatrix4fv(_uRingModel, 1, GL_FALSE, model);
        glUniform3fv(_uRingColor, 1, rc.color);
        glUniform1f(_uRingDotCount, rc.dots);
        glDrawElements(GL_TRIANGLES, _ringIndexCount, GL_UNSIGNED_INT, nullptr);
    }

    // ── Restore state ────────────────────────────────────────────────────
    glBindVertexArray((GLuint)prevVAO);
    glUseProgram((GLuint)prevProgram);
    glDepthMask(prevDepthMask);
    glDepthFunc((GLenum)prevDepthFunc);
    if (prevCullFace) glEnable(GL_CULL_FACE); else glDisable(GL_CULL_FACE);
    if (prevBlend)    glEnable(GL_BLEND);     else glDisable(GL_BLEND);
    glBlendFuncSeparate((GLenum)prevBlendSrcRGB, (GLenum)prevBlendDstRGB,
                          (GLenum)prevBlendSrcAlpha, (GLenum)prevBlendDstAlpha);
}

}  // namespace orb
}  // namespace viroexternal
