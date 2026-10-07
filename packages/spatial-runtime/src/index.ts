export {
  getSpatialWorkerRuntime,
  scheduleSpatialWorklet,
} from "./worklets";

export {
  DEFAULT_SPATIAL_MEMORY_POLICY,
  shouldKeepNative,
  type SpatialMemoryPolicy,
  type SpatialResourceDescriptor,
  type SpatialResourceKind,
  type SpatialResourceOwner,
} from "./memory";

export {
  preferredBackend,
  type SpatialComputeBackend,
  type SpatialHeavyTask,
} from "./tasks";
