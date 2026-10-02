# @viro-external/pano

Compatibility entrypoint for panorama applications.

The old package used a Nitro-generated control plane and custom native pano pass.
The premium stack now uses `SpatialPanorama` from `@viro-external/media`, backed
by Viro's native 360 image component.

New code should import from `@viro-external/media` or
`@viro-external/premium/media`.
