# Specs runtime detection

`@viro-external/specs` exposes a small runtime API modeled after the ergonomics
of `expo-horizon-core`, while using Snap's own Lens Studio runtime evidence.

## Quick usage

```ts
import {
  SpecsRuntime,
  isSpecsDevice,
  isSpecsBuild,
  useSpecs,
} from "@viro-external/specs";

if (isSpecsDevice()) {
  // Running on physical Spectacles.
}

if (SpecsRuntime.isSpecsBuild) {
  // This bundle is a Specs target.
}

function SpatialExperience() {
  const specs = useSpecs();

  if (specs.isDevice) {
    // Specs-specific presentation is allowed here.
  }

  return null;
}
```

## What each flag means

- `isSpecsDevice()` uses Lens Studio's `deviceInfoSystem.isSpectacles()`.
- `isSpecsEditor()` uses `deviceInfoSystem.isEditor()`.
- `isSpecsRuntime()` is true for physical Spectacles or Lens Studio editor.
- `isSpecsBuild()` is true on physical Spectacles, or when the Specs build
  bootstrap sets `global.__VIRO_SPECS_BUILD__ = true`.
- `getSpecsRuntime()` returns one normalized snapshot.
- `useSpecs()` returns that same snapshot with React-friendly naming. It has
  no React dependency because device/build identity does not change during a
  render session.

## Why the build marker exists

`isEditor()` only proves that code is running in Lens Studio. It does not prove
that the current project targets Spectacles. Treating every Lens Studio preview
as a Specs build would create false positives.

The generated Specs bootstrap should therefore set:

```ts
global.__VIRO_SPECS_BUILD__ = true;
```

Physical hardware does not need the marker because `isSpectacles()` is the
authoritative device signal.

## Capability checks still matter

Runtime identity and capabilities are separate questions.

Use the identity API when presentation genuinely differs on Specs:

```ts
const { isDevice } = useSpecs();

if (isDevice) {
  // Choose a Specs-optimized HUD.
}
```

Use `XRCapabilityReport` for feature behavior:

```ts
const capabilities = await adapter.getCapabilities();

if (capabilities["hand-tracking"] === "supported") {
  // Enable hand interaction.
}
```

This keeps the app ergonomic without hard-coding assumptions that every future
Spectacles model has exactly the same hardware.
