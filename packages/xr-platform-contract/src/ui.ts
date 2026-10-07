/**
 * Vendor-neutral wearable UI contracts and upstream parity catalogs.
 *
 * Vendor source code, CSS, fonts, icons, and assets remain in their upstream
 * repositories. This file describes the portable API surface only.
 */

export type XRUIComponentKind =
  | "app-shell"
  | "backplate"
  | "container"
  | "surface"
  | "card"
  | "card-stack"
  | "frame"
  | "button"
  | "round-button"
  | "capsule-button"
  | "rectangle-button"
  | "button-group"
  | "button-rail"
  | "button-divider"
  | "checkbox"
  | "radio-button"
  | "switch"
  | "toggle-group"
  | "slider"
  | "confirmation-slider"
  | "scrubber"
  | "scroll-bar"
  | "scroll-view"
  | "scroll-window"
  | "vertical-list"
  | "grid-layout"
  | "pager"
  | "carousel"
  | "text"
  | "text-switcher"
  | "read-more-text"
  | "text-input"
  | "icon"
  | "image"
  | "media"
  | "header"
  | "page"
  | "sub-navigation"
  | "tooltip"
  | "context-menu"
  | "vertical-menu"
  | "modal"
  | "toast"
  | "divider"
  | "chip"
  | "tag"
  | "progress"
  | "progress-ring"
  | "pagination-indicator"
  | "swipe-indicator"
  | "volume-indicator"
  | "zoom-indicator"
  | "avatar"
  | "badge"
  | "shimmer"
  | "vignette"
  | "action-hint";

export type XRUIInteractionState =
  | "idle"
  | "hover"
  | "focused"
  | "pressed"
  | "disabled"
  | "checked"
  | "unchecked"
  | "expanded"
  | "collapsed"
  | "indeterminate";

import type { XRUIInputSource } from "./interaction.js";

export type XRUIComponentParity = {
  kind: XRUIComponentKind;
  specs?: string;
  metaRayBanDisplay?: string;
  viro?: string;
  notes?: string;
};

export const SPECS_UI_KIT_COMPONENTS = [
  "backplate",
  "frame",
  "button",
  "capsule-button",
  "rectangle-button",
  "round-button",
  "checkbox",
  "radio-button",
  "scroll-bar",
  "scroll-window",
  "slider",
  "confirmation-slider",
  "switch",
  "text-input",
  "toggle-group",
  "grid-layout",
] as const satisfies readonly XRUIComponentKind[];

export const META_RAY_BAN_DISPLAY_UI_COMPONENTS = [
  "app-shell",
  "container",
  "surface",
  "card",
  "card-stack",
  "text",
  "text-switcher",
  "read-more-text",
  "icon",
  "image",
  "media",
  "scroll-view",
  "vertical-list",
  "pager",
  "carousel",
  "button",
  "button-group",
  "button-rail",
  "button-divider",
  "switch",
  "radio-button",
  "slider",
  "scrubber",
  "chip",
  "tag",
  "divider",
  "page",
  "header",
  "sub-navigation",
  "tooltip",
  "context-menu",
  "vertical-menu",
  "modal",
  "toast",
  "progress",
  "progress-ring",
  "pagination-indicator",
  "swipe-indicator",
  "volume-indicator",
  "zoom-indicator",
  "avatar",
  "badge",
  "shimmer",
  "vignette",
  "action-hint",
] as const satisfies readonly XRUIComponentKind[];

export const XR_UI_COMPONENT_PARITY = [
  { kind: "app-shell", metaRayBanDisplay: "App" },
  { kind: "backplate", specs: "BackPlate", viro: "GlassesBackplate" },
  { kind: "container", metaRayBanDisplay: "Container", viro: "GlassesContainer" },
  { kind: "surface", metaRayBanDisplay: "Surface", viro: "SpatialPanel" },
  { kind: "card", metaRayBanDisplay: "Card", viro: "GlassesCard" },
  { kind: "card-stack", metaRayBanDisplay: "CardStack", viro: "GlassesCardStack" },
  { kind: "frame", specs: "Frame", viro: "GlassesFrame" },
  { kind: "button", specs: "BaseButton / RectangleButton", metaRayBanDisplay: "Button", viro: "GlassesButton" },
  { kind: "round-button", specs: "RoundButton", viro: "GlassesRoundButton" },
  { kind: "capsule-button", specs: "CapsuleButton", viro: "GlassesCapsuleButton" },
  { kind: "rectangle-button", specs: "RectangleButton", viro: "GlassesRectangleButton" },
  { kind: "button-group", metaRayBanDisplay: "ButtonGroup", viro: "GlassesButtonGroup" },
  { kind: "button-rail", metaRayBanDisplay: "ButtonRail", viro: "GlassesButtonRail" },
  { kind: "button-divider", metaRayBanDisplay: "ButtonDivider", viro: "GlassesButtonDivider" },
  { kind: "checkbox", specs: "Checkbox", metaRayBanDisplay: "Checkbox pattern", viro: "GlassesCheckbox" },
  { kind: "radio-button", specs: "RadioButton", metaRayBanDisplay: "RadioButton", viro: "GlassesRadioButton" },
  { kind: "switch", specs: "Switch", metaRayBanDisplay: "Switch", viro: "GlassesSwitch" },
  { kind: "toggle-group", specs: "ToggleGroup / SwitchToggleGroup", viro: "GlassesToggleGroup" },
  { kind: "slider", specs: "Slider", metaRayBanDisplay: "SliderBar", viro: "GlassesSlider" },
  { kind: "confirmation-slider", specs: "ConfirmationSlider", viro: "GlassesConfirmationSlider" },
  { kind: "scrubber", metaRayBanDisplay: "Scrubber", viro: "GlassesScrubber" },
  { kind: "scroll-bar", specs: "ScrollBar", viro: "GlassesScrollBar" },
  { kind: "scroll-view", metaRayBanDisplay: "ScrollView", viro: "SpatialScrollView" },
  { kind: "scroll-window", specs: "ScrollWindow", viro: "GlassesScrollWindow" },
  { kind: "vertical-list", metaRayBanDisplay: "VerticalList", viro: "GlassesVerticalList" },
  { kind: "grid-layout", specs: "GridLayout", viro: "GlassesGridLayout" },
  { kind: "pager", metaRayBanDisplay: "Pager", viro: "GlassesPager" },
  { kind: "carousel", metaRayBanDisplay: "Carousel", viro: "GlassesCarousel" },
  { kind: "text", metaRayBanDisplay: "TextView", viro: "GlassesText" },
  { kind: "text-switcher", metaRayBanDisplay: "TextSwitcher", viro: "GlassesTextSwitcher" },
  { kind: "read-more-text", metaRayBanDisplay: "ReadMoreTextView", viro: "GlassesReadMoreText" },
  { kind: "text-input", specs: "TextInputField", metaRayBanDisplay: "InputTextView", notes: "Viro requires a host text-input/keyboard adapter; the shared component must not fake keyboard input." },
  { kind: "icon", metaRayBanDisplay: "IconImage", viro: "GlassesIcon" },
  { kind: "image", metaRayBanDisplay: "MediaWrapper", viro: "GlassesImage" },
  { kind: "media", metaRayBanDisplay: "MediaWrapper", viro: "GlassesMedia" },
  { kind: "header", metaRayBanDisplay: "Header", viro: "GlassesHeader" },
  { kind: "page", metaRayBanDisplay: "Page", viro: "GlassesPage" },
  { kind: "sub-navigation", metaRayBanDisplay: "SubNavigation / SubNavigationPager", viro: "GlassesSubNavigation" },
  { kind: "tooltip", specs: "Tooltip", metaRayBanDisplay: "Tooltip", viro: "GlassesTooltip" },
  { kind: "context-menu", metaRayBanDisplay: "ContextMenu", viro: "GlassesContextMenu" },
  { kind: "vertical-menu", metaRayBanDisplay: "VerticalMenu", viro: "GlassesVerticalMenu" },
  { kind: "modal", metaRayBanDisplay: "Modal", viro: "GlassesModal" },
  { kind: "toast", metaRayBanDisplay: "Toast", viro: "GlassesToast" },
  { kind: "divider", metaRayBanDisplay: "Divider", viro: "GlassesDivider" },
  { kind: "chip", metaRayBanDisplay: "Chip", viro: "GlassesChip" },
  { kind: "tag", metaRayBanDisplay: "Tag", viro: "GlassesTag" },
  { kind: "progress", metaRayBanDisplay: "ProgressIndicator", viro: "GlassesProgress" },
  { kind: "progress-ring", metaRayBanDisplay: "ProgressRing", viro: "GlassesProgressRing" },
  { kind: "pagination-indicator", metaRayBanDisplay: "PaginationIndicator", viro: "GlassesPaginationIndicator" },
  { kind: "swipe-indicator", metaRayBanDisplay: "SwipeIndicator", viro: "GlassesSwipeIndicator" },
  { kind: "volume-indicator", metaRayBanDisplay: "VolumeIndicator", viro: "GlassesVolumeIndicator" },
  { kind: "zoom-indicator", metaRayBanDisplay: "ZoomIndicator", viro: "GlassesZoomIndicator" },
  { kind: "avatar", metaRayBanDisplay: "Avatar", viro: "GlassesAvatar" },
  { kind: "badge", metaRayBanDisplay: "AppBadge / NotificationBadge", viro: "GlassesBadge" },
  { kind: "shimmer", metaRayBanDisplay: "Shimmer / ShimmerItem", viro: "GlassesShimmer" },
  { kind: "vignette", metaRayBanDisplay: "Vignette", viro: "GlassesVignette" },
  { kind: "action-hint", metaRayBanDisplay: "ActionHint", viro: "GlassesActionHint" },
] as const satisfies readonly XRUIComponentParity[];

export function getXRUIComponentParity(kind: XRUIComponentKind): XRUIComponentParity | undefined {
  return XR_UI_COMPONENT_PARITY.find((item) => item.kind === kind);
}

export type XRUITextInputAdapter = {
  requestFocus(): Promise<void> | void;
  dismiss(): Promise<void> | void;
  isAvailable(): boolean;
};

export type XRUIFocusModel = {
  enabled: boolean;
  preferredInput: XRUIInputSource;
  wrapAround?: boolean;
  preserveOnNavigation?: boolean;
};

export type XRUIComponentModel = {
  id: string;
  kind: XRUIComponentKind;
  label?: string;
  value?: string | number | boolean;
  disabled?: boolean;
  visible?: boolean;
  min?: number;
  max?: number;
  step?: number;
  focused?: boolean;
  state?: XRUIInteractionState;
  width?: number;
  height?: number;
  children?: readonly XRUIComponentModel[];
};
