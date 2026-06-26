export { Control3D, type Control3DProps, type PointerEvent } from "./Control3D";
export { Container3D, type Container3DProps, type ArrangedChild, type ArrangeContext } from "./Container3D";
export { Button3D, type Button3DProps } from "./Button3D";
export { HolographicButton, type HolographicButtonProps } from "./HolographicButton";
export { StackPanel3D, type StackPanel3DProps } from "./StackPanel3D";
export {
  CylinderPanel,
  type CylinderPanelProps,
  type VolumeOrientation,
  deriveCylinderArc,
} from "./CylinderPanel";
export { HolographicSlate, type HolographicSlateProps } from "./HolographicSlate";
export { SceneZone, SCENE_ZONES, type SceneZoneProps, type SceneZoneName } from "./SceneZone";
export { MovablePanelContext, useInsideMovablePanel } from "./MovablePanelContext";
export { useGuiStore, type GuiState } from "./guiStore";

// ── Wave 2 ──
export {
  VolumeBasedPanel,
  type VolumeBasedPanelProps,
  type VolumeMapper,
  type VolumeMappingContext,
} from "./VolumeBasedPanel";
export { PlanePanel, type PlanePanelProps } from "./PlanePanel";
export { SpherePanel, type SpherePanelProps, deriveSphereSpacing } from "./SpherePanel";
export { ScatterPanel, type ScatterPanelProps } from "./ScatterPanel";
export { TouchHolographicButton, type TouchHolographicButtonProps } from "./TouchHolographicButton";
export { MeshButton3D, type MeshButton3DProps } from "./MeshButton3D";
export { Slider3D, type Slider3DProps, useSliderStore } from "./Slider3D";
export { TouchHolographicMenu, type TouchHolographicMenuProps } from "./TouchHolographicMenu";
