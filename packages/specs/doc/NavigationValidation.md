# Specs navigation and automated validation

This layer completes the first long-term Specs backend stack with navigation,
route rendering and an executable Platform Lab validation contract.

## Navigation

Routing providers such as Mapbox should stay outside the Specs renderer.

```text
Mapbox / route provider
        ↓
lat/lon route geometry
        ↓
compileSpecsNavigationPlan
        ↓
SpecsNavigationKit
        +
VolumetricLine
        ↓
world-space navigation on Specs
```

`SpecsNavigationKit` owns location/user-position/place semantics.
`VolumetricLine` owns the visible 3D route geometry.

That split avoids forcing a traditional mobile map renderer into the glasses.

## ViroPolyline parity

`compileSpecsPolyline()` provides the Specs path for a ViroPolyline-like
primitive. A polyline becomes a VolumetricLine plan with local/world points and
a radius derived from Viro-style line width.

The rendering implementation may be a generated tube mesh rather than the
native ViroCore line renderer. Behavioral and visual intent are the parity
target.

## Automated validation

The upstream SPECS 27 package corpus includes:

- `AiPreviewAgentInspect`: live Lens scene inspection/render captures
- `AiPreviewAgentInteract`: synthetic pinch, poke and drag

`SPECS_PLATFORM_LAB_PLAN` uses those capabilities to define a canonical
end-to-end test:

1. assert a panel exists;
2. assert text exists;
3. assert a model has RenderMeshVisual;
4. assert the button exists;
5. pinch the button;
6. drag the model;
7. capture the resulting scene.

The same semantic test should be implemented for ViroCore targets. This gives
the project cross-backend behavioral parity tests instead of relying only on
screenshots or manual QA.

## Capability model

The XR contract includes explicit capability names for:

- location navigation
- volumetric lines
- runtime inspection
- synthetic interaction

Applications can therefore detect support without hard-coding `Specs`.
