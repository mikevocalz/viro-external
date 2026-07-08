import React, { useMemo, useState } from "react";
import { ViroGeometry, ViroNode } from "@reactvision/react-viro";
import { ClippedImage3D } from "./ClippedImage3D";
import type { Vec3 } from "react-native-viro-mux";
import { roundedPlateBuffers } from "./roundedPlate";
import { annularArcOutlineBuffers } from "./annularArc";
import { DecaTheme, registerDecaTheme } from "./decaTheme";
import { Text3D } from "./Text3D";

/**
 * D.E.C.A. account HUD — a compact cyber panel (ember theme) showing the
 * user's avatar + screen name. Meant to pin in the top-right of the view.
 *
 * Pure presentation: the parent supplies avatarUrl / displayName / status
 * (typically from @expo-pico/account getUserProfile()). Avatar is a circular-
 * masked remote image with an ember ring; name sits to its right.
 */
export interface UserAccountPanelProps {
  displayName: string;
  avatarUrl?: string | null;
  /** PICO user id — mono line in the column. */
  userId?: string | null;
  /** Small status line — "PICO • linked" / "connecting…". */
  subtitle?: string;
  position?: Vec3;
  rotation?: Vec3;
  /** Fallback avatar (require()'d asset) when avatarUrl is null. */
  fallbackAvatar?: number;
}

const W = 0.52;
const H = 0.16;
const AV = 0.11; // avatar edge, meters

export function UserAccountPanel(props: UserAccountPanelProps): React.ReactElement {
  const { displayName, avatarUrl, userId, subtitle, position, rotation, fallbackAvatar } = props;
  registerDecaTheme();
  const [hovered, setHovered] = useState(false);

  const plate = useMemo(() => roundedPlateBuffers(W, H, H * 0.28, 12), []);
  const edge = useMemo(() => roundedPlateBuffers(W + 0.008, H + 0.008, H * 0.3, 12), []);
  const avRing = useMemo(() => annularArcOutlineBuffers(AV * 0.52, AV * 0.6, 0, 360, 40), []);

  // Avatar hard-left inside the plate; the info column fills from just right
  // of it to the right margin. Text3D positions its box by CENTER, so textX is
  // the midpoint of [textLeft, textRight] — NOT the left edge.
  const avX = -W / 2 + AV / 2 + 0.02;
  const textLeft = avX + AV / 2 + 0.02;
  const textRight = W / 2 - 0.02;
  const textX = (textLeft + textRight) / 2;
  const textW = textRight - textLeft;

  const source = avatarUrl ? { uri: avatarUrl } : fallbackAvatar;

  return (
    <ViroNode position={position} rotation={rotation}>
      {/* Ember edge glow behind the plate. */}
      <ViroGeometry
        vertices={edge.vertices} normals={edge.normals} texcoords={edge.texcoords}
        triangleIndices={edge.triangleIndices}
        materials={[hovered ? DecaTheme.emberHot : DecaTheme.ember]}
        position={[0, 0, -0.003]} ignoreEventHandling
      />
      {/* Dark chrome plate — also the hover surface. */}
      <ViroGeometry
        vertices={plate.vertices} normals={plate.normals} texcoords={plate.texcoords}
        triangleIndices={plate.triangleIndices}
        materials={[hovered ? DecaTheme.plateHover : DecaTheme.plate]}
        onHover={(h: boolean) => setHovered(h)}
      />
      {/* Avatar + ember ring. ClippedImage3D = geometry-clipped circle — a
          bare ViroImage renders the full square source past the ring
          (there is no overflow:hidden in 3D; clipping IS the mesh). */}
      {source !== undefined && source !== null && (
        <ClippedImage3D source={source} width={AV} height={AV} position={[avX, 0, 0.004]} />
      )}
      <ViroGeometry
        vertices={avRing.vertices} normals={avRing.normals} texcoords={avRing.texcoords}
        triangleIndices={avRing.triangleIndices}
        materials={[DecaTheme.rose]} position={[avX, 0, 0.006]} ignoreEventHandling
      />
      {/* Info column on the right — name, user id, status stacked. */}
      <Text3D
        text={displayName}
        width={textW} height={0.038}
        textAlign="left" fillRatio={0.95} fontWeight="700"
        fontFamily="Republica-Minor" color="#FFE0DC"
        position={[textX, 0.042, 0.006]}
      />
      {userId !== undefined && userId !== null && (
        <Text3D
          text={userId}
          width={textW} height={0.024}
          textAlign="left" fillRatio={0.9}
          color="#C88894"
          position={[textX, 0.004, 0.006]}
        />
      )}
      {subtitle !== undefined && (
        <Text3D
          text={subtitle}
          width={textW} height={0.026}
          textAlign="left" fillRatio={0.9}
          color="#D89098"
          position={[textX, -0.036, 0.006]}
        />
      )}
    </ViroNode>
  );
}
