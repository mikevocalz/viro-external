# @viro-external/viture

Native VITURE transport boundary for Esiku.

VITURE is isolated from the shared OpenXR renderer. The adapter owns the
SDK-specific lifecycle and translates its capabilities into XRCapabilityReport.

The actual SDK calls belong in the native transport implementation; this
portable TypeScript package must not import vendor SDK headers.

## Required skills

- VITURE native SDK integration for supported Luma/Cyber/Beast families
- native display and stereo-session lifecycle
- pose/input transport without JS frame stepping
- camera/microphone/audio permission and ownership
- GPU/native surface ownership
- React Native/Expo native-module integration
- physical-device validation and graceful capability fallback

## Architecture rule

Do not force VITURE into OpenXR just to reduce adapter count. Use OpenXR when
the runtime exposes the required capability; use this native lane for
capabilities that are only available through VITURE's SDK.
