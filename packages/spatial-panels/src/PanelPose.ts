/**
 * A panel pose in the OpenXR app space, which is also the Viro scene's world
 * space: position in metres and an xyzw unit quaternion.
 *
 * For a `cylinder` panel the position is the centre of the circle the arc lies
 * on; the visible surface sits {@link CompositorPanelOptions.cylinderRadiusM}
 * in front of it along -Z.
 *
 * @see {@link CompositorPanelHandle.setPose}
 */
export interface PanelPose {
  readonly position: readonly [number, number, number];
  readonly orientation: readonly [number, number, number, number];
}
