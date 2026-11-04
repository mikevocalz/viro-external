# @viro-external/gui — legacy compatibility

This package preserves the original GUI3D control tree for existing applications.

New development should use **`@viro-external/ui`** or the
**`@viro-external/premium`** umbrella. The premium UI owns the new
`SpatialPanel`, `PanelHeader`, `SpatialScrollView`, content primitives and
provider-neutral `VideoPlayerPanel` without requiring the old Mux/Nitro media
bridge.

Existing components remain here so applications can migrate incrementally
instead of taking a forced breaking rewrite.

## Panel migration — no duplicate chrome

`HolographicSlate` and `CylinderPanel` are compatibility adapters that render
**one** `@viro-external/ui/SpatialPanel` each. Only the latter retains its
cylindrical child layout. Pin, close, snapping, curved backing, movement and
material ownership belong to the canonical panel, not independent GUI3D
states or renderers.

For all new app UI import `SpatialPanel` from `@viro-external/ui` or
`@viro-external/premium` only. Do **not** nest these legacy adapters inside
`SpatialPanel` or `SpatialWorkspaceSlotNode`. See
[one-panel system](../../docs/ONE-PANEL-SYSTEM.md).
