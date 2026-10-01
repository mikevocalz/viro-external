# XR adapter architecture

```text
feature/application state
        |
@viro-external/xr-contract
        |
+-------+--------------+----------------+
|                      |                |
Viro OpenXR       WebSpatial      wearable adapters
|                      |                |
Quest/PICO/       PICO OS 6       Meta DAT /
Meta VR Glasses                   Snap Specs
```

## What is portable

- capability names and support state;
- layout/surface intent;
- basic scene graph nodes needed by foreign-runtime adapters;
- semantic interaction events;
- lifecycle/disposal contract.

## What is not portable

- Viro render passes, shaders, material internals, physics, portals, or native texture handles;
- Lens Studio component implementation details;
- Meta Wearables session objects;
- WebSpatial JS bridge handles;
- platform-specific permission objects.

Adapters may expose additional native APIs alongside this shared floor.
