// Public surface for @viro-external/core.
// (ViroSlate + ViroGaussianSplat exports land with PROMPT-3 / PROMPT-4.)

export {
  ViroCylinderSurface,
  type ViroCylinderSurfaceProps,
} from "./ViroCylinderSurface";

export {
  buildCylinderGeometry,
  type BuildCylinderOptions,
  type CylinderGeometryBuffers,
} from "./buildCylinderGeometry";

export { ViroSlate, ViroSlateMaterialNames, type ViroSlateProps } from "./ViroSlate";

export {
  ViroGaussianSplat,
  type ViroGaussianSplatProps,
  type ViroGaussianSplatSource,
  type ViroGaussianSplatMeta,
  type SplatSourceFormat,
} from "./splat/ViroGaussianSplat";
export {
  isNativeSplatRendererAvailable,
  fallbackDeviceProfile,
  type NativeSplatRendererModule,
} from "./splat/NativeSplatRenderer";

export { MovableNode, type MovableNodeProps } from "./MovableNode";
export { createPlaceholderMaterial } from "./createPlaceholderMaterial";
export type {
  AxisLock,
  ExternalTextureHandle,
  MovableProps,
  Vec3,
  ViroDragPlane,
  ViroDragType,
} from "./spatialTypes";
