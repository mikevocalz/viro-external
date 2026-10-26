//
//  RiveSurfaceLink.hpp — @viro-external/native-panels
//
//  Owns one CanvasSurfaces subscription (through the Kotlin RiveSurfaceLink)
//  and the RiveSurfaceTarget it calls into. Not thread-safe: the owning
//  HybridRivePanel closes it once.
//

#pragma once

#include "JRiveSurfaceLink.hpp"
#include "RiveSurfaceTarget.hpp"

#include <cstdint>
#include <memory>

namespace margelo::nitro::nativepanels::rive {

class RiveSurfaceLink final {
public:
  // Subscribes. Throws when the Viro build has no CanvasSurfaces registry or
  // the JNI call fails; the Kotlin side has closed the link by then (see
  // RiveSurfaceLink.subscribe), so freeing the target is safe.
  RiveSurfaceLink(int32_t surfaceId, std::unique_ptr<RiveSurfaceTarget> target);
  ~RiveSurfaceLink();
  RiveSurfaceLink(const RiveSurfaceLink&) = delete;
  RiveSurfaceLink& operator=(const RiveSurfaceLink&) = delete;

  // Ends the subscription and frees the target. No callback runs after this
  // returns. Never throws: when the JNI close fails, it logs and leaks the
  // target, since Kotlin may still call into it. Idempotent.
  void close() noexcept;

private:
  void leakTarget(const char* reason) noexcept;

  std::unique_ptr<RiveSurfaceTarget> _target;
  facebook::jni::global_ref<JRiveSurfaceLink::javaobject> _java;
};

} // namespace margelo::nitro::nativepanels::rive
