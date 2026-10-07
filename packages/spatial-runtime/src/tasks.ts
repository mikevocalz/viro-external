export type SpatialComputeBackend =
  | "react-native"
  | "worklet"
  | "typegpu"
  | "eskiu-native";

export type SpatialHeavyTask =
  | "layout-resolution"
  | "gesture-filtering"
  | "scene-query-postprocess"
  | "mesh-generation"
  | "mesh-deformation"
  | "particle-update"
  | "splat-sort"
  | "splat-cull"
  | "image-kernel"
  | "buffer-compaction"
  | "native-render-state";

export function preferredBackend(task: SpatialHeavyTask): SpatialComputeBackend {
  switch (task) {
    case "layout-resolution":
      return "react-native";
    case "gesture-filtering":
    case "scene-query-postprocess":
      return "worklet";
    case "mesh-deformation":
    case "particle-update":
    case "splat-sort":
    case "splat-cull":
    case "image-kernel":
    case "buffer-compaction":
      return "typegpu";
    case "mesh-generation":
    case "native-render-state":
      return "eskiu-native";
  }
}
