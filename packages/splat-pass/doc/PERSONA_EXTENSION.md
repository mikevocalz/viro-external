# Native persona extension — implementation status

This is a standalone premium component. It does not belong to Moyo.

## Implemented in this change

Registration validates the native navigator tag and supported static SPZ input.
Release is asynchronous, coalesces concurrent calls and permits retry after a
native failure. The core component forwards its navigator tag and handles
asynchronous release errors. Unsupported temporal and throttling options fail
explicitly instead of silently doing nothing.

The shared native persona engine is developed in Nitro Forge PR 64:
https://github.com/mikevocalz/nitro-forge/pull/64
It owns calibrated controls, bounded playback, reference covariance deformation
and tracking/audio selection. It is usable from C++ without React Native; Nitro
v1 is a separate adapter. Do not duplicate that engine here.

## Live tracking design

SDK adapters remain unimplemented. No headset tracking is claimed by this PR.
Native adapters must query extension support, device capabilities, permissions,
tracking validity and data source at runtime. Sensor estimates and audio-derived
expressions must remain distinguishable. Do not infer support from a brand name.

| Provider | Integration target | Signals and limits |
| --- | --- | --- |
| Meta | Movement SDK / XR_FB_face_tracking2 and XR_FB_eye_tracking_social | Facial weights including tongue controls; camera-driven facial tracking availability differs from audio-driven expressions. |
| PICO | MotionTracking supported/start/state/data APIs | Vendor-ordered 52 blendshapes plus 20 visemes; TongueOut index 51. Query supported modes and preserve their camera/audio provenance. |
| Android XR | XR_ANDROID_face_tracking, XR_ANDROID_face_tracking_data_source, XR_ANDROID_eye_tracking | Facial weights include tongue out/left/right/up/down; coarse/fine eye modes and permissions differ. Query actual runtime support. |
| visionOS | Separate platform adapter | Do not assume access to system Persona internals or raw eye/face tracking. Establish supported public APIs before promising parity. |

Vendor weights are not interchangeable arrays. Map each named channel into a
calibrated target rig. Store unsupported channels as invalid, not measured zero.
Preserve per-eye gaze poses separately from facial weights, including reference
space, timestamp, validity and confidence when exposed. Convert provider clocks
into a common monotonic session clock before mixing; reset on session loss.

For a live human persona, valid recent measured facial channels override audio
animation. Audio2Face-3D fills missing channels; neutral controls replace stale
inputs. Audio2Emotion is an explicit artistic input, never an inferred sensor
measurement. For an AI persona, synthesized speech drives the face independently
of the wearer. Never silently apply the wearer's mouth motion to an AI speaker.

The C++ reference selector in Forge tests source precedence, measured zero,
stale/future timestamps, invalid values and mismatched layouts. SDK capture,
native frame transport, smooth transitions and renderer binding remain pending.
No React state updates or JavaScript callback should drive the render frame loop.

## Native renderer gate

Package AGENTS.md requires a verified post-opaque hook and a matching built AAR
before native changes. Current scripts/sync-viro-3-1.sh pins ViroCore
8a5bdc47aa0f47d9c6249461ef5f07fe77fe60ac, whose inspected choreographer header
lacks setCustomPostOpaquePass. The older v2.55.0-nitro-canvas branch has the hook
and four render call sites. Matching current binary provenance is not verified.
Restore the hook to the chosen current source, build and pin matching AARs,
and verify OpenXR loader and 16 KB alignment before renderer implementation.

## Remaining advanced work (not shipped)

1. Native SDK capture adapters and permission/session lifecycle, with headset tests.
2. GNM model fitting/evaluation from images/video and calibrated rig export.
3. Mesh-bound splat deformation, per-eye sorting of animated positions, and
   explicit eyes/teeth/tongue geometry. A static SPZ file alone is not a facial rig.
4. Complete SH decoding, documented format versions, progressive streaming,
   importance LOD and measured GPU budgets.
5. Native time sampling, seeking and bounded network interpolation for 4D playback.
6. Metal/visionOS and Android XR rendering adapters, stereo/depth/occlusion tests.
7. NVIDIA Audio2Face-3D / Audio2Emotion host integration and synchronized audio.
   CUDA inference is separate from the local native tracking/rendering path.

## Official references checked 2026-11-07

- https://developers.meta.com/vr/documentation/native/android/move-face-tracking/
- https://developers.meta.com/vr/documentation/unity/move-face-tracking/
- https://developer.picoxr.com/document/unity/face-tracking/
- https://developer.android.com/develop/xr/openxr/extensions
- https://developer.android.com/develop/xr/openxr/extensions/XR_ANDROID_eye_tracking
- https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrFaceParameterIndicesANDROID.html
