// VROOrbRenderPass.h
// @viro-external/orb-pass
//
// Renders the D.E.C.A. orb inside Viro's OpenXR per-eye loop as a
// VROMultiplexRenderPass child. Ported from ~/orb/src/orb.ts:
//   • Core sphere with fbm-noise ember pulse (buildCoreMaterial, :226-276)
//   • 3 rotating rings with soft-dot glow (buildRings, :311-359)
// Shell + morph targets deliberately deferred — this is the "look" MVP
// (visible + animated), not the full lipsync/breath rig.

#ifndef VIRO_EXTERNAL_ORB_VROORBRENDERPASS_H
#define VIRO_EXTERNAL_ORB_VROORBRENDERPASS_H

#include "VRORenderPass.h"
#include <GLES3/gl3.h>
#include <atomic>
#include <limits>
#include <memory>

class VRONode;

namespace viroexternal {
namespace orb {

class VROOrbRenderPass final : public VRORenderPass {
public:
    VROOrbRenderPass();
    ~VROOrbRenderPass() override;

    VROOrbRenderPass(const VROOrbRenderPass&) = delete;
    VROOrbRenderPass& operator=(const VROOrbRenderPass&) = delete;

    void render(std::shared_ptr<VROScene> scene,
                std::shared_ptr<VROScene> outgoingScene,
                VRORenderPassInputOutput &inputs,
                VRORenderContext *context,
                std::shared_ptr<VRODriver> &driver) override;

    // ── Reactive uniforms — safe to call from any thread ────────────────
    // Follows the pattern from ~/orb/src/orb.ts:378-381 (setTalkEnergy) and
    // orb.ts:429-436 (spring smoothing). Springs live on the render thread;
    // JS just pushes targets. Values clamped [0,1].
    void setTalkTarget(float value);
    void setIgnitionTarget(float value);
    void setBreathOverride(float value);      // if >= 0, replaces auto-sine breath
    void setListenTarget(float value);        // 1 = awake/attentive, 0 = idle

    // World-anchored position. Once called, orb stops tracking head and
    // stays where JS placed it — pass NaN for x to revert to head-relative.
    void setWorldPosition(float x, float y, float z);

private:
    void lazyInit();
    void buildCoreProgram();
    void buildRingProgram();
    void buildCoreVBO();
    void buildRingVBO();
    void buildShieldProgram();
    void buildPointProgram();

    bool   _initialized = false;

    // ── Core (icosphere + ember pulse) ──────────────────────────────────
    GLuint _coreProgram = 0;
    GLuint _coreVao     = 0;
    GLuint _coreVbo     = 0;
    GLuint _coreIbo     = 0;
    GLsizei _coreIndexCount = 0;
    GLint _uCoreModel  = -1;
    GLint _uCoreView   = -1;
    GLint _uCoreProj   = -1;
    GLint _uCoreTime   = -1;
    GLint _uCoreIgnition = -1;
    GLint _uCoreBreath = -1;
    GLint _uCoreTalk   = -1;

    // ── Rings (torus + soft-dot glow) ───────────────────────────────────
    GLuint _ringProgram = 0;
    GLuint _ringVao     = 0;
    GLuint _ringVbo     = 0;   // interleaved pos(3) + uv(2)
    GLuint _ringIbo     = 0;
    GLsizei _ringIndexCount = 0;
    GLint _uRingModel  = -1;
    GLint _uRingView   = -1;
    GLint _uRingProj   = -1;
    GLint _uRingColor  = -1;
    GLint _uRingIntensity = -1;
    GLint _uRingDotCount  = -1;
    GLint _uRingPulseScale = -1;

    // ── Force shield (fresnel bubble between core and rings) ────────────
    GLuint _shieldProgram = 0;   // geometry shared with core (_coreVao)
    GLint _uShModel = -1, _uShView = -1, _uShProj = -1;
    GLint _uShTime = -1, _uShIgnition = -1, _uShBreath = -1, _uShTalk = -1;
    GLint _uShSpeed = -1, _uShVelDir = -1, _uShCamPos = -1;

    // ── Particles (attribute-less GL_POINTS, gl_VertexID-driven) ────────
    GLuint _pointProgram = 0;
    GLuint _pointVao = 0;
    GLint _uPtModel = -1, _uPtView = -1, _uPtProj = -1;
    GLint _uPtTime = -1, _uPtIgnition = -1, _uPtTalk = -1;
    GLint _uPtSpeed = -1, _uPtVelDir = -1;

    // Drag velocity of the anchor (world units/s, smoothed) — drives the
    // shield wake and particle streaming while the orb is moved.
    bool  _velInit = false;
    float _pAX = 0, _pAY = 0, _pAZ = 0;
    float _velX = 0, _velY = 0, _velZ = 0;

    // Orb world position — hardcoded for MVP. Later: config from JS.
    static constexpr float kOrbX     = 0.0f;
    static constexpr float kOrbY     = 1.6f;
    static constexpr float kOrbZ     = -1.2f;
    static constexpr float kOrbScale = 0.30f;

    // Reactive state — JS-driven targets, render-thread springs.
    std::atomic<float> _talkTarget    { 0.0f };
    std::atomic<float> _ignitionTarget{ 1.0f };
    std::atomic<float> _breathOverride{ -1.0f };  // <0 = use auto-sine
    std::atomic<float> _listenTarget  { 0.0f };
    std::atomic<float> _worldX{ std::numeric_limits<float>::quiet_NaN() };
    int _instFrames = 0;   // per-instance; the static probe counter is process-wide
    // Rendered-anchor smoothing (exponential glide toward the target anchor).
    bool  _smoothInit = false;
    float _smoothX = 0, _smoothY = 0, _smoothZ = 0;

    // Scene anchor node (viroTag "orb-anchor"): when present, the orb glues
    // to this node's world position every frame — drag runs fully native,
    // no JS in the loop. Re-searched periodically (cheap tree walk).
    std::weak_ptr<VRONode> _anchorNode;
    int _anchorSearchCountdown = 0;
    std::atomic<float> _worldY{ 0.0f };
    std::atomic<float> _worldZ{ 0.0f };
    // Spring state — updated on render thread only.
    float _talkValue    = 0.0f;
    float _talkSlow     = 0.0f;   // heavily smoothed — drives scale swell
    float _listenValue  = 0.0f;
    float _talkVel      = 0.0f;
    float _ignitionValue = 1.0f;
    float _ignitionVel  = 0.0f;
    double _lastRenderSec = -1.0;
};

}  // namespace orb
}  // namespace viroexternal

#endif  // VIRO_EXTERNAL_ORB_VROORBRENDERPASS_H
