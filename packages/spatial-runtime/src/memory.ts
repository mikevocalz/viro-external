export type SpatialResourceOwner =
  | "react-native"
  | "worklet"
  | "viro-native"
  | "eskiu"
  | "gpu";

export type SpatialResourceKind =
  | "geometry"
  | "texture"
  | "video-frame"
  | "splat-buffer"
  | "scene-mesh"
  | "transform-buffer"
  | "compute-buffer"
  | "scratch";

export type SpatialResourceDescriptor = {
  id: string;
  kind: SpatialResourceKind;
  owner: SpatialResourceOwner;
  byteLength?: number;
  mutable?: boolean;
};

export type SpatialMemoryPolicy = {
  maxWorkerRuntimes: number;
  preferHandlesAcrossRuntimeBoundaries: boolean;
  duplicateGpuResourcesAcrossRuntimes: boolean;
  nativeLargeBufferThresholdBytes: number;
};

export const DEFAULT_SPATIAL_MEMORY_POLICY: SpatialMemoryPolicy = {
  maxWorkerRuntimes: 1,
  preferHandlesAcrossRuntimeBoundaries: true,
  duplicateGpuResourcesAcrossRuntimes: false,
  nativeLargeBufferThresholdBytes: 256 * 1024,
};

export function shouldKeepNative(
  resource: Pick<SpatialResourceDescriptor, "byteLength" | "kind">,
  policy: SpatialMemoryPolicy = DEFAULT_SPATIAL_MEMORY_POLICY
): boolean {
  const size = resource.byteLength ?? 0;

  if (
    resource.kind === "video-frame" ||
    resource.kind === "splat-buffer" ||
    resource.kind === "scene-mesh"
  ) {
    return true;
  }

  return size >= policy.nativeLargeBufferThresholdBytes;
}
