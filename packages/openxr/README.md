# @viro-external/openxr

Capability-first OpenXR adapter for Esiku.

Android XR is explicitly an OpenXR 1.1 target, with feature availability
reported through runtime extension enumeration. Some Android XR capabilities
also require Android runtime permissions, so unsupported and
permission-required must remain distinct in the native implementation.

The adapter maps extension presence to Viro's existing XRCapabilityReport.
It does not create device-specific renderers.

## Target mapping

- Android XR -> OpenXR
- XREAL AURA -> OpenXR
- RayNeo -> OpenXR first
- Steam Frame -> OpenXR
- Quest -> OpenXR

## Native handoff

The probe is intentionally data-only. ViroCore owns:

1. loader initialization
2. instance/system/session creation
3. graphics binding and swapchains
4. native frame wait/begin/end lifecycle
5. reference-space and action-set lifecycle
6. render-thread ownership

Esiku consumes the negotiated result and exposes capability state upward.

## Required skills

- OpenXR 1.1 loader/runtime integration
- Android XR extension enumeration
- Android runtime permission handling for scene understanding, eye tracking,
  hand tracking and camera
- OpenXR interaction profiles and action sets
- ViroCore OpenGL ES / OpenXR frame lifecycle
- XREAL, RayNeo and Steam Frame runtime validation
