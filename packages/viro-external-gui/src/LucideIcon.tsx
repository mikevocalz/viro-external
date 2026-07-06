import React from "react";
import { ViroImage } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";

/**
 * Lucide icons rasterized to white PNGs at build time (scripts/gen-icons.mjs)
 * — Viro renders textures, not SVG. Static require map keeps Metro happy.
 */
const ICONS = {
  x: require("../assets/icons/x.png"),
  pin: require("../assets/icons/pin.png"),
  "pin-off": require("../assets/icons/pin-off.png"),
  "chevron-up": require("../assets/icons/chevron-up.png"),
  "chevron-down": require("../assets/icons/chevron-down.png"),
  play: require("../assets/icons/play.png"),
  pause: require("../assets/icons/pause.png"),
  "volume-2": require("../assets/icons/volume-2.png"),
  "volume-x": require("../assets/icons/volume-x.png"),
  menu: require("../assets/icons/menu.png"),
  globe: require("../assets/icons/globe.png"),
  mic: require("../assets/icons/mic.png"),
  video: require("../assets/icons/video.png"),
  image: require("../assets/icons/image.png"),
  settings: require("../assets/icons/settings.png"),
  "message-square": require("../assets/icons/message-square.png"),
  eye: require("../assets/icons/eye.png"),
} as const;

export type LucideIconName = keyof typeof ICONS;

export interface LucideIconProps {
  name: LucideIconName;
  /** Icon edge length in meters. */
  size?: number;
  position?: Vec3;
  opacity?: number;
}

export function LucideIcon(props: LucideIconProps): React.ReactElement {
  const { name, size = 0.05, position, opacity } = props;
  return (
    <ViroImage
      source={ICONS[name]}
      width={size}
      height={size}
      position={position}
      opacity={opacity}
      ignoreEventHandling
    />
  );
}
