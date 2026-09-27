#include "HybridPanoController.hpp"

/**
 * G1 no-op implementations. Every method validates and returns/rejects
 * honestly — nothing pretends to work. G2 replaces preload + attach with the
 * real EGL-thread pipeline and choreographer registration
 * (Renderer.getChoreographerRef() seam — see workspace DECISIONS.md §G0.4).
 */

namespace margelo::nitro::viropano {

static constexpr const char* kNotImplemented = "E_NOT_IMPLEMENTED";

void HybridPanoController::attach(double /*nodeTag*/) {
  // G2: resolve choreographer, register pano draw (first, depth off).
}

void HybridPanoController::detach() {}

std::shared_ptr<Promise<PanoTextureHandle>> HybridPanoController::preload(
    const std::string& /*url*/, StereoLayout /*stereo*/) {
  auto promise = Promise<PanoTextureHandle>::create();
  promise->reject(std::make_exception_ptr(
      std::runtime_error("PanoController.preload: not implemented (G2)")));
  return promise;
}

std::shared_ptr<Promise<PanoTextureHandle>>
HybridPanoController::preloadFromPixels(
    const std::shared_ptr<ArrayBuffer>& /*pixels*/, double /*width*/,
    double /*height*/) {
  auto promise = Promise<PanoTextureHandle>::create();
  promise->reject(std::make_exception_ptr(std::runtime_error(
      "PanoController.preloadFromPixels: not implemented (G2)")));
  return promise;
}

void HybridPanoController::releaseTexture(double /*handleId*/) {}

std::shared_ptr<Promise<void>> HybridPanoController::transitionTo(
    double /*handleId*/, const std::optional<PanoTransitionOptions>& /*opts*/) {
  auto promise = Promise<void>::create();
  promise->reject(std::make_exception_ptr(
      std::runtime_error("PanoController.transitionTo: not implemented (G3)")));
  return promise;
}

void HybridPanoController::cancelTransition() {}
void HybridPanoController::setImmediate(double /*handleId*/) {}
void HybridPanoController::comfortFade(double /*durationMs*/) {}

} // namespace margelo::nitro::viropano
