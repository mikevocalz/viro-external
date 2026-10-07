# Esiku XR capability contract

Esiku is the native hardware bridge for Viro's expanding XR surface. The
contract is capability-first: Viro components request spatial capabilities
and do not branch on a product name.

## Target lanes

| Hardware / family | Esiku lane | Renderer |
| --- | --- | --- |
| Android XR devices | openxr | ViroCore OpenXR |
| XREAL AURA | openxr | ViroCore OpenXR |
| RayNeo | openxr + optional native extensions | ViroCore OpenXR |
| VITURE | viture-native | VITURE SDK-backed native surface |
| HTC VIVE Eagle | wearable | wearable I/O adapter; no fake 3D renderer |
| Valve Steam Frame | openxr | ViroCore OpenXR |
| Meta Quest | openxr | existing ViroCore OpenXR |
| Apple Vision Pro | existing visionOS lane | existing ViroCore visionOS |

The target is metadata for diagnostics and SDK selection only. Runtime feature
gating must use EsikuCapabilityReport.

## Required rules

- Do not create one Viro renderer per glasses model.
- Do not use screenshots, WebViews, bitmap frame stepping, or JS-driven
  rendering as a substitute for native surfaces.
- OpenXR targets share the existing ViroCore OpenXR renderer.
- Vendor-specific SDKs are isolated behind Esiku adapters.
- Unsupported capabilities remain explicit and are surfaced to Viro.
- Controller, hand, gaze, touch, and voice are normalized into semantic input
  events rather than leaking vendor event types into Viro.

## Skills / implementation knowledge required

PRs consuming this contract should explicitly use:

1. OpenXR native runtime integration — session lifecycle, swapchains, reference
   spaces, interaction profiles, extension negotiation and frame timing.
2. Android XR / OpenXR capability negotiation — runtime discovery, permissions,
   planes, anchors, passthrough and scene understanding.
3. ViroCore native renderer integration — C++ frame ownership, render-thread
   affinity, JNI boundaries and existing OpenXR renderer lifecycle.
4. VITURE native SDK integration — native display/pose/input transport with
   graceful capability fallback.
5. RayNeo native/OpenXR integration — prefer OpenXR; use ARDK/native APIs only
   for capabilities unavailable through OpenXR.
6. Wearable SDK integration — VIVE Eagle camera/mic/audio/device-control
   transport without pretending a wearable I/O device is a ViroCore renderer.
7. Steam Frame OpenXR input — OpenXR controller/interaction-profile
   negotiation and controllerless fallback where runtime capabilities permit.
8. React Native/Expo native-module design — expose negotiated capabilities
   without embedding vendor SDK lifecycle in React components.
9. Hardware validation — Quest, Android XR/XREAL, RayNeo, VITURE and Steam
   Frame device/simulator matrices; VIVE Eagle wearable transport tests.

These are engineering requirements, not runtime dependencies of this package.
