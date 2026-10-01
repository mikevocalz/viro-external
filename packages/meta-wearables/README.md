# @viro-external/meta-wearables

Integration foundation for **Meta Wearables Device Access Toolkit (DAT) 1.0**.

This package targets Meta **AI glasses** through a paired Android app. It is intentionally separate from Meta VR Glasses, which run Viro's Horizon/OpenXR renderer directly.

## Expo Android setup

Meta publishes DAT 1.0.0 to Maven Central under the `com.meta.wearable` group. The Expo plugin adds the selected artifacts plus the required Wearables Developer Center application ID.

```ts
export default {
  expo: {
    plugins: [
      [
        "@viro-external/meta-wearables",
        {
          applicationId: process.env.META_WEARABLES_APP_ID,
          version: "1.0.0",
          modules: [
            "core",
            "camera",
            "display",
            "inputs",
            "motion",
            "speech",
          ],
          analyticsOptOut: true,
          crashReportingOptOut: true,
        },
      ],
    ],
  },
};
```

Available DAT artifact switches:

- `core`
- `camera`
- `display`
- `inputs`
- `motion`
- `mockdevice`
- `speech`

`core` is always included.

## Capability-first adapter

Different Meta glasses expose different capabilities. Do not choose behavior from a product name.

```ts
import { MetaWearablesAdapter } from "@viro-external/meta-wearables";

const adapter = new MetaWearablesAdapter(nativeTransport);
const caps = await adapter.getCapabilities();

if (caps.display === "supported") {
  // Display-capable glasses path.
} else {
  // Audio/camera-first displayless path.
}
```

## Current PR boundary

This PR wires the real DAT 1.0 Android artifacts/manifest and establishes the cross-platform transport API. The next PR owns the React Native native module/session lifecycle and Mock Device Kit implementation.

Until that native transport lands, this package is a **foundation**, not a claim that camera/display sessions are already bridged to JavaScript.

## Why this is not ViroCore

DAT extends a phone app to AI glasses. It is not the immersive OpenXR renderer used by Quest/Meta VR Glasses, and displayless glasses cannot host a Viro 3D scene. Keeping the integration in `viro-external` prevents wearable SDK dependencies from bloating ViroCore.
