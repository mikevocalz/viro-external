import React, { useMemo } from "react";
import { ViroGeometry, ViroMaterials } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import { roundedPlateBuffers } from "./roundedPlate";

/**
 * Image clipped to a rounded-rect / circle — the XR "overflow: hidden".
 *
 * A ViroImage is a bare quad: the full source always renders, spilling past
 * any ring/frame drawn over it (the avatar-corners bug, 2026-07-08). There is
 * no scissor/overflow in a 3D scene — clipping must be GEOMETRY. This maps
 * the image as a diffuse texture onto a rounded-plate mesh, so pixels outside
 * the shape simply don't exist.
 *
 *   cornerRadius = min(width, height) / 2  →  circle/pill (avatar default).
 *
 * One material per distinct source (idempotent, name-addressable). The
 * source is set at material creation and never swapped — swapping a texture
 * SOURCE mid-render is the fork's null-texture SIGSEGV; a NEW source makes a
 * NEW material name instead.
 */
export interface ClippedImage3DProps {
  /** { uri } or require()'d asset. */
  source: { uri: string } | number;
  width: number;
  height: number;
  /** Defaults to min(width, height)/2 — a circle/pill. */
  cornerRadius?: number;
  position?: Vec3;
  opacity?: number;
}

const registered = new Set<string>();

function materialFor(source: { uri: string } | number): string {
  const key = typeof source === "number" ? `asset_${source}` : source.uri;
  // Material names must be identifier-ish; hash the key.
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  const name = `vxgClippedImg_${(h >>> 0).toString(36)}`;
  if (!registered.has(name)) {
    registered.add(name);
    ViroMaterials.createMaterials({
      [name]: { diffuseTexture: source, lightingModel: "Constant" },
    });
  }
  return name;
}

export function ClippedImage3D(props: ClippedImage3DProps): React.ReactElement {
  const { source, width, height, cornerRadius, position, opacity } = props;
  const r = cornerRadius ?? Math.min(width, height) / 2;
  const materialName = useMemo(() => materialFor(source), [source]);
  const mesh = useMemo(() => {
    const m = roundedPlateBuffers(width, height, r, 16);
    // Image V origin is at the TOP; plate texcoords put v=1 at the top edge.
    return { ...m, texcoords: m.texcoords.map(([u, v]) => [u, 1 - v] as [number, number]) };
  }, [width, height, r]);
  return (
    <ViroGeometry
      vertices={mesh.vertices}
      normals={mesh.normals}
      texcoords={mesh.texcoords}
      triangleIndices={mesh.triangleIndices}
      materials={[materialName]}
      position={position}
      opacity={opacity}
      ignoreEventHandling
    />
  );
}
