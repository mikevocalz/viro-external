#pragma once

/**
 * HybridPanoController — pano control plane (PROMPT 21 §3).
 *
 * THREADING (§5, non-negotiable):
 *  - Every method here arrives on the JS thread. Validate args, enqueue onto
 *    the render-thread command queue, resolve/reject Promises. NEVER touch
 *    GL or VRO objects directly from these entry points (R2).
 *  - Texture creation happens on the shared EGL context thread (Mode A).
 *  - The transition state machine advances on the Viro render thread.
 *  - Callbacks post through Nitro's dispatcher — never invoked from the
 *    render thread directly (§6.7).
 *
 * G1 STATE: no-op skeleton — proves codegen + instantiation on device.
 * The pano-pass, preload pipeline, and transition engine land at G2–G4.
 */

#include "HybridPanoControllerSpec.hpp"

#include <atomic>
#include <functional>
#include <string>

namespace margelo::nitro::viropano {

class HybridPanoController : public HybridPanoControllerSpec {
public:
  HybridPanoController() : HybridObject(TAG) {}

  // ── Sync getters ────────────────────────────────────────────────────
  bool getIsTransitioning() override { return _isTransitioning.load(); }
  double getCurrentBlend() override { return _currentBlend.load(); }

  // ── Lifecycle ───────────────────────────────────────────────────────
  void attach(double nodeTag) override;
  void detach() override;

  // ── Preload ─────────────────────────────────────────────────────────
  std::shared_ptr<Promise<PanoTextureHandle>> preload(
      const std::string& url, StereoLayout stereo) override;
  std::shared_ptr<Promise<PanoTextureHandle>> preloadFromPixels(
      const std::shared_ptr<ArrayBuffer>& pixels, double width,
      double height) override;
  void releaseTexture(double handleId) override;

  // ── Transitions ─────────────────────────────────────────────────────
  std::shared_ptr<Promise<void>> transitionTo(
      double handleId,
      const std::optional<PanoTransitionOptions>& opts) override;
  void cancelTransition() override;
  void setImmediate(double handleId) override;
  void comfortFade(double durationMs) override;

  // ── Callbacks ───────────────────────────────────────────────────────
  void onTransitionStart(
      const std::function<void(PanoTransitionType)>& cb) override {
    _onTransitionStart = cb;
  }
  void onTransitionEnd(const std::function<void()>& cb) override {
    _onTransitionEnd = cb;
  }
  void onError(const std::function<void(const std::string&,
                                        const std::string&)>& cb) override {
    _onError = cb;
  }

private:
  std::atomic<bool> _isTransitioning{false};
  std::atomic<double> _currentBlend{0.0};
  std::function<void(PanoTransitionType)> _onTransitionStart;
  std::function<void()> _onTransitionEnd;
  std::function<void(const std::string&, const std::string&)> _onError;
};

} // namespace margelo::nitro::viropano
