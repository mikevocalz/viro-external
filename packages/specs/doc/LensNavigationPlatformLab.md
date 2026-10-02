# Lens navigation and Platform Lab runtime

This PR makes the navigation and validation contracts executable in Lens Studio.

## Route rendering

`ViroSpecsNavigationRuntime` uses two upstream SPECS 27 packages together:

- `SpecsNavigationKit` maps latitude/longitude locations into the current
  north-aligned Lens world.
- `VolumetricLine` renders the resulting route geometry as a 3D tube.

The routing provider remains external. Mapbox, another routing API, or app-owned
route data feeds `SpecsNavigationPlan`; the Specs backend owns only spatial
presentation.

### Units

- geographic coordinates stay latitude/longitude/altitude
- Navigation Kit returns Lens world coordinates in centimeters
- portable Viro polylines are meters and are converted by `×100`
- Viro line width/radius values are converted to Lens centimeters

## Live GPS updates

The runtime subscribes to Navigation Kit's user-position updates and recomputes
the world-space location of every geographic route point. The VolumetricLine
mesh is then refreshed without changing the portable route.

## Platform Lab

`ViroSpecsPlatformLab` creates the canonical test IDs defined in
`SPECS_PLATFORM_LAB_PLAN`:

- platform-lab-panel
- platform-lab-title
- platform-lab-model
- platform-lab-button

It enables pinch/select on the button and manipulation on the model.

## Agent validation

`ViroSpecsAgentValidation` installs the upstream
`AiPreviewAgentInspect` and `AiPreviewAgentInteract` components in Lens
Studio preview. Those upstream tools are intentionally editor-only and remain
inert on physical Specs.

That gives the external validation runner a real scene to inspect and lets it
synthesize pinch/poke/drag actions against the same IDs used by the portable
Platform Lab plan.
