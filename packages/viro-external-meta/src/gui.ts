// Re-export of @viro-external/gui. Verified against packages/viro-external-gui/src/index.ts.

export {
  // Wave 1
  Control3D, type Control3DProps, type PointerEvent,
  Container3D, type Container3DProps, type ArrangedChild, type ArrangeContext,
  Button3D, type Button3DProps,
  HolographicButton, type HolographicButtonProps,
  StackPanel3D, type StackPanel3DProps,
  CylinderPanel, type CylinderPanelProps, type VolumeOrientation, deriveCylinderArc,
  HolographicSlate, type HolographicSlateProps,
  SceneZone, SCENE_ZONES, type SceneZoneProps, type SceneZoneName,
  MovablePanelContext, useInsideMovablePanel,
  useGuiStore, type GuiState,
  // Wave 2
  VolumeBasedPanel, type VolumeBasedPanelProps, type VolumeMapper, type VolumeMappingContext,
  PlanePanel, type PlanePanelProps,
  SpherePanel, type SpherePanelProps, deriveSphereSpacing,
  ScatterPanel, type ScatterPanelProps,
  TouchHolographicButton, type TouchHolographicButtonProps,
  MeshButton3D, type MeshButton3DProps,
  Slider3D, type Slider3DProps, useSliderStore,
  TouchHolographicMenu, type TouchHolographicMenuProps,
} from "@viro-external/gui";
