# @viro-external/gui — legacy compatibility

This package preserves the original GUI3D control tree for existing applications.

New development should use **`@viro-external/ui`** or the
**`@viro-external/premium`** umbrella. The premium UI owns the new
`SpatialPanel`, `PanelHeader`, `SpatialScrollView`, content primitives and
provider-neutral `VideoPlayerPanel` without requiring the old Mux/Nitro media
bridge.

Existing components remain here so applications can migrate incrementally
instead of taking a forced breaking rewrite.
