import React from "react";
import { ViroNode } from "@reactvision/react-viro";
import defaults from "../config/defaults.json";
import type { Vec3 } from "react-native-viro-mux";

type ZoneName = keyof typeof defaults.zones;

interface ZoneConfig {
  position: Vec3;
  yawDeg: number;
  pitchDeg: number;
}

export interface SceneZoneProps {
  name: ZoneName;
  children: React.ReactNode;
}

const ZONES_TABLE = defaults.zones as unknown as Record<string, ZoneConfig>;

export function SceneZone(props: SceneZoneProps): React.ReactElement {
  const zone = ZONES_TABLE[props.name];
  if (!zone) {
    throw new Error(`SceneZone: unknown zone '${props.name}'`);
  }
  return (
    <ViroNode position={zone.position} rotation={[zone.pitchDeg, zone.yawDeg, 0]}>
      {props.children}
    </ViroNode>
  );
}

export const SCENE_ZONES = ZONES_TABLE;
export type SceneZoneName = ZoneName;
