# PICO spatial layout architecture

## Runtime split

### PICO OS 5 / legacy devices
Use the normal React Native adaptive layout for application UI and Viro/OpenXR for immersive XR.

### PICO OS 6 Spatial SDK
Promote the same semantic workspace into native spatial containers when capability checks say the runtime path exists.

Do not branch product components by device name. Branch in the adapter from runtime capabilities.

## Native bridge ownership

`@viro-external/pico-layout` owns only mapping and intent.

`@expo-pico/spatial` should own:

- SDK detection and versioning;
- WindowContainer creation/open/close;
- Subwindow/Augment/Toolbar/SpatialPopup presentation;
- AttachmentPanelComponent hosting for React Native Android Views;
- Stage transitions;
- capability reporting back to JavaScript.

## Fallback

If the PICO Spatial SDK is not linked, not supported by the current OS/device, or cannot host the requested primitive, return inline/drop behavior rather than claiming spatial support.

## React Native state

Keep application state in the normal React Native/Zustand/domain layer. A native window is a presentation target, not a second copy of feature state.
