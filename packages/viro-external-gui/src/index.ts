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
export { DecaSlate, type DecaSlateProps, type SlateMode } from "./DecaSlate";
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
export { FluentMaterials, registerFluentMaterials } from "./materials";
export { Text3D, computeText3DFontSize, type Text3DProps } from "./Text3D";
export { LucideIcon, type LucideIconName } from "./LucideIcon";
export { ScrollPanel3D, type ScrollPanel3DProps } from "./ScrollPanel3D";
export { PanelHeader3D, TitleBarButton, type PanelHeader3DProps } from "./PanelHeader3D";
export { Reveal3D, type Reveal3DProps } from "./Reveal3D";
export {
  MuxPlayerPanel,
  getMuxPanelState,
  useMuxPanelStore,
  type MuxPanelState,
  type MuxPlayerPanelProps,
} from "./MuxPlayerPanel";

// ── Wave 5 — cyberpunk radial HUD ──
export { RadialMenu3D, type RadialMenu3DProps, type RadialMenuItem } from "./RadialMenu3D";
export { annularArcBuffers, annularArcOutlineBuffers } from "./annularArc";

// ── Wave 4 — concentric-arc chrome math ──
export {
  makeArcFrame,
  arcTheta,
  polarPose,
  arcPlateBuffers,
  type ArcFrame,
  type ArcPose,
  type ArcPlateBuffers,
} from "./arc";
export { Keyboard3D, type Keyboard3DProps } from "./Keyboard3D";
export { UserAccountPanel, type UserAccountPanelProps } from "./UserAccountPanel";
export { DecaTheme, registerDecaTheme } from "./decaTheme";
export { ClippedImage3D, type ClippedImage3DProps } from "./ClippedImage3D";
