# @viro-external/meta-wearables

Groundwork for Meta's Wearables Device Access Toolkit (DAT) 1.0 in an Expo / React Native app. DAT lets a phone app reach Meta AI glasses. The package has two parts:

- an **Expo config plugin** (Android only) that adds the DAT 1.0 Maven artifacts and the required manifest `meta-data`;
- a **TypeScript adapter**, `MetaWearablesAdapter`, that turns a device capability map into the shared `XRCapabilityReport` from `@viro-external/xr-contract`.

The package ships no native module. Nothing in it opens a session with the glasses, streams the camera or writes to a display. You supply the transport (see [Status](#status)).

Meta VR glasses and Quest headsets are out of scope. They run Viro's Horizon / OpenXR renderer directly; for Horizon OS windows see `@viro-external/meta-layout`.

## Supported glasses and SDK

| Item | Value | Source |
| --- | --- | --- |
| SDK | Meta Wearables Device Access Toolkit 1.0 | `package.json` description |
| Default artifact version | `1.0.0` | `plugin/index.js` (`DEFAULT_VERSION`) |
| Maven coordinates | `com.meta.wearable:mwdat-<module>:<version>` | `plugin/index.js` |
| Target devices | Meta AI glasses paired with an Android phone, with or without a display | package design |
| Platforms configured | Android only. The plugin makes no iOS changes. | `plugin/index.js` |

The package names no specific glasses models. Capabilities vary by model, so the adapter reports what the connected device exposes and your code should branch on that, never on a product name.

## Requirements

| Peer dependency | Range |
| --- | --- |
| `expo` | `>=58.0.0 <59.0.0` |
| `@expo/config-plugins` | `>=58.0.0 <59.0.0` |
| `react-native` | `>=0.88.0-rc.0 <0.89.0` |
| `@viro-external/xr-contract` | `workspace:*` |

You also need a DAT application ID from the Wearables Developer Center.

## Setup

1. Add the workspace packages to your app (inside this monorepo):

   ```json
   {
     "dependencies": {
       "@viro-external/meta-wearables": "workspace:*",
       "@viro-external/xr-contract": "workspace:*"
     }
   }
   ```

2. Register the plugin in `app.config.ts` (or `app.json`):

   ```ts
   export default {
     expo: {
       plugins: [
         [
           "@viro-external/meta-wearables",
           {
             applicationId: process.env.META_WEARABLES_APP_ID,
             version: "1.0.0",
             modules: ["core", "camera", "display", "inputs", "motion", "speech"],
             analyticsOptOut: true,
             crashReportingOptOut: true,
           },
         ],
       ],
     },
   };
   ```

3. Regenerate the native project: `npx expo prebuild --clean`. Do not edit `android/app/build.gradle` or `AndroidManifest.xml` by hand; the plugin owns those changes and prebuild rewrites them.

4. Build the Android app and provide your own `MetaWearablesTransport`. This package has no native module yet, so the transport is your code.

## Config plugin options

| Option | Type | Required | Default | Effect |
| --- | --- | --- | --- | --- |
| `applicationId` | string | yes | none | Written to manifest `meta-data` `com.meta.wearable.mwdat.APPLICATION_ID`. Prebuild throws `applicationId is required (Wearables Developer Center application ID)` when it is missing. |
| `version` | string | no | `"1.0.0"` | Version used for every `mwdat-*` artifact. |
| `modules` | string[] | no | `["core", "camera", "display", "inputs", "motion", "speech"]` | Which `mwdat-*` artifacts to add. An empty array also means the default list. |
| `analyticsOptOut` | boolean | no | not written | Written to `com.meta.wearable.mwdat.ANALYTICS_OPT_OUT` only when it is a boolean. |
| `crashReportingOptOut` | boolean | no | not written | Written to `com.meta.wearable.mwdat.CRASH_REPORTING_OPT_OUT` only when it is a boolean. |

### `modules`

Valid names: `core`, `camera`, `display`, `inputs`, `motion`, `mockdevice`, `speech`.

- `core` is always added, first, even if you leave it out.
- Duplicates are removed.
- Any other name fails prebuild with `unknown DAT module <name>`.
- `mockdevice` is valid but not in the default list. Add it explicitly to pull in DAT's mock device artifact.

### What the plugin writes

**`android/app/build.gradle`** (`withAppBuildGradle`): one line per module, inserted right after the first `dependencies {` block opener:

```groovy
dependencies {
    implementation "com.meta.wearable:mwdat-core:1.0.0"
    implementation "com.meta.wearable:mwdat-camera:1.0.0"
    // ...one line per selected module
```

Lines already present are skipped, so running prebuild twice does not duplicate them. If the file has no `dependencies {` block, prebuild throws. Changing `version` without `--clean` leaves the old lines in place next to the new ones; use `npx expo prebuild --clean`.

**`AndroidManifest.xml`** (`withAndroidManifest`): `<meta-data>` entries on `<application>`. An existing entry with the same name is updated in place.

```xml
<meta-data android:name="com.meta.wearable.mwdat.APPLICATION_ID" android:value="..." />
<meta-data android:name="com.meta.wearable.mwdat.ANALYTICS_OPT_OUT" android:value="true" />
<meta-data android:name="com.meta.wearable.mwdat.CRASH_REPORTING_OPT_OUT" android:value="true" />
```

The plugin does not add Maven repositories. This package's earlier notes state that Meta publishes DAT 1.0.0 to Maven Central under `com.meta.wearable`; if your build cannot resolve the artifacts, add the repository from your own config plugin.

## Permissions

The plugin adds **no** `<uses-permission>` entries: no Bluetooth, camera, microphone or any other permission. It only adds Gradle dependencies and `meta-data`. Whether the DAT AARs contribute permissions through Android manifest merging has not been checked. Inspect the merged manifest of your build, and request runtime permissions in your app as DAT requires.

## JavaScript API

```ts
import {
  MetaWearablesAdapter,
  type MetaWearablesCapability,
  type MetaWearablesDeviceCapabilities,
  type MetaWearablesTransport,
} from "@viro-external/meta-wearables";
```

| Export | Kind | Description |
| --- | --- | --- |
| `MetaWearablesCapability` | type | `"camera" \| "microphone" \| "audio" \| "display" \| "inputs" \| "motion" \| "speech"` |
| `MetaWearablesDeviceCapabilities` | type | `Partial<Record<MetaWearablesCapability, boolean>>` |
| `MetaWearablesTransport` | interface | `getDeviceCapabilities()` (sync or async) and `dispose()`. The boundary a native module or a mock implements. |
| `MetaWearablesAdapter` | class | `XRPlatformAdapter` with `family: "meta-wearables"`. Constructor takes a transport. |

### `MetaWearablesAdapter`

`getCapabilities()` is always async. It calls `transport.getDeviceCapabilities()` and maps each value: `true` to `"supported"`, `false` to `"unsupported"`, missing to `"unverified"`.

| Device capability | Report key | Value |
| --- | --- | --- |
| `camera` | `camera` | mapped |
| `microphone` | `microphone` | mapped |
| `audio` | `audio-output` | mapped |
| `display` | `display` | mapped |
| `motion` | `motion` | mapped |
| none | `immersive-rendering` | always `"unsupported"` |
| none | `spatial-web` | always `"unsupported"` |

`inputs` and `speech` exist in `MetaWearablesCapability` but are not in the report. Read them from the transport directly if you need them.

`dispose()` forwards to `transport.dispose()`. The optional `presentSurface()` and `updatePortableScene()` from `XRPlatformAdapter` are not implemented.

### Example

```ts
import {
  MetaWearablesAdapter,
  type MetaWearablesTransport,
} from "@viro-external/meta-wearables";

// Replace with your native module. A fixed map works for tests.
const transport: MetaWearablesTransport = {
  getDeviceCapabilities: () => ({
    camera: true,
    microphone: true,
    audio: true,
    display: false,
  }),
  dispose: () => {},
};

export async function chooseGlassesPath(): Promise<"display" | "audio-camera"> {
  const adapter = new MetaWearablesAdapter(transport);
  try {
    const caps = await adapter.getCapabilities();
    // caps.display is "unsupported" here; caps.motion is "unverified" because the map omits it.
    return caps.display === "supported" ? "display" : "audio-camera";
  } finally {
    await adapter.dispose();
  }
}
```

## Glasses and the spatial workspace contract

This package has no layout concept. It exports no window, anchor, size or priority mapping, and it ignores `SpatialSurfaceIntent` and `SpatialWorkspaceIntent` entirely.

The link to `@viro-external/xr-contract` is the capability side only. `MetaWearablesAdapter` implements `XRPlatformAdapter` under the `"meta-wearables"` family and returns an `XRCapabilityReport`, so app code can ask "is there a display?" the same way it asks a Quest or PICO adapter. The contract also defines a `"wearable-display"` presentation and a `"neural-band"` interaction source, but nothing in this package produces or consumes them.

In practice, keep the phone app's workspace (master / content / inspector) on the phone and treat the glasses as a peripheral that adds camera, audio and, on display models, a small glanceable surface. Viro 3D scenes do not run on these glasses: the adapter always reports `immersive-rendering: "unsupported"`, and displayless glasses have nowhere to show one.

## Status

| Area | Implemented | Device-validated |
| --- | --- | --- |
| Config plugin: Gradle `mwdat-*` dependencies | yes | no |
| Config plugin: manifest `meta-data` (application ID, opt-outs) | yes | no |
| Option validation (missing `applicationId`, unknown module) | yes | not applicable |
| `MetaWearablesAdapter` capability mapping | yes | no |
| `MetaWearablesTransport` interface | yes (interface only) | no |
| Native React Native module / session lifecycle | no | no |
| Mock Device Kit transport | no (only the `mockdevice` Gradle switch) | no |
| Camera, microphone, display, speech, input or motion data in JS | no | no |
| iOS setup | no | no |
| Android permissions | none added | no |

"Implemented" means the code exists in this package and passes `tsc`. No row has been run against real glasses, and the package has no unit tests. A comment in `src/index.ts` assigns the native module to a follow-up PR and keeps the transport injectable so Mock Device Kit and unit tests can use the same adapter.

## References

- Meta Wearables Device Access Toolkit: https://developers.meta.com/wearables/device-access-toolkit
- Meta wearables developer landing page: https://developers.meta.com/wearables/
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
- Shared contract: [`packages/xr-platform-contract/doc/SpatialWorkspace.md`](../xr-platform-contract/doc/SpatialWorkspace.md)
- Horizon OS windows: [`packages/meta-layout/README.md`](../meta-layout/README.md)
