import React, { useEffect, useMemo } from "react";
import { ViroGeometry, ViroMaterials, ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import {
  MovableNode,
  type ExternalTextureHandle,
  type MovableProps,
  type Vec3,
} from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { buildCylinderGeometry } from "./buildCylinderGeometry";

let autoMaterialId = 0;

export interface ViroSlateProps extends MovableProps {
  title?: string;
  widthMeters?: number;
  heightMeters?: number;
  /** Texture pixel size of the offscreen render that backs this slate. Caller's responsibility. */
  resolution?: [number, number];
  /** 0 = flat, 1 = fully curved. Uses cylinder geometry for > 0. */
  curvature?: number;
  variant?: "solid" | "glass";
  /**
   * External texture produced by the caller (Skia/WebGPU/native FBO) and registered
   * via `registerExternalTexture`. The slate displays this on its content surface.
   *
   * Lifecycle: the caller registers it before mount and releases it after unmount.
   * The slate does NOT register/release on the caller's behalf — it only displays.
   * (See doc/OffscreenRender.md for the separation rationale.)
   */
  externalTexture?: ExternalTextureHandle;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  onError?: (error: Error) => void;
}

interface ViroBuffers {
  vertices: [number, number, number][];
  normals: [number, number, number][];
  texcoords: [number, number][];
  triangleIndices: [number, number, number][];
}

function curvedBuffers(width: number, height: number, curvature: number): ViroBuffers {
  const thetaLength = curvature * (2 * Math.PI / 3);
  const radius = width / 2 / Math.sin(thetaLength / 2);
  const halfArc = thetaLength / 2;
  const g = buildCylinderGeometry({
    height,
    radiusTop: radius,
    radiusBottom: radius,
    radialSegments: 32,
    heightSegments: 1,
    thetaStart: Math.PI / 2 - halfArc,
    thetaLength,
    openEnded: true,
  });
  const verts: [number, number, number][] = [];
  for (let i = 0; i < g.positions.length; i += 3) {
    verts.push([g.positions[i]!, g.positions[i + 1]!, g.positions[i + 2]!]);
  }
  const norms: [number, number, number][] = [];
  for (let i = 0; i < g.normals.length; i += 3) {
    norms.push([g.normals[i]!, g.normals[i + 1]!, g.normals[i + 2]!]);
  }
  const uvs: [number, number][] = [];
  for (let i = 0; i < g.uvs.length; i += 2) {
    uvs.push([g.uvs[i]!, g.uvs[i + 1]!]);
  }
  const tris: [number, number, number][] = [];
  for (let i = 0; i < g.indices.length; i += 3) {
    tris.push([g.indices[i]!, g.indices[i + 1]!, g.indices[i + 2]!]);
  }
  return { vertices: verts, normals: norms, texcoords: uvs, triangleIndices: tris };
}

export function ViroSlate(props: ViroSlateProps): React.ReactElement {
  const {
    title,
    widthMeters = defaults.slate.widthMeters,
    heightMeters = defaults.slate.heightMeters,
    curvature = 0,
    variant = "solid",
    externalTexture,
    position,
    rotation,
    scale,
    // Movable
    movable,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
  } = props;

  const contentMaterial = useMemo(() => `viroSlate_content_${++autoMaterialId}`, []);
  // Materials must exist BEFORE the native quads mount — registering in a
  // useEffect leaves the first commit with an unknown material (renders
  // white, never re-applies). Register synchronously during render.
  // Colors are Android #AARRGGBB (alpha FIRST), not web #RRGGBBAA.
  const chromeMaterial = useMemo(() => {
    const name = `viroSlate_chrome_${variant}_${autoMaterialId}`;
    ViroMaterials.createMaterials({
      [contentMaterial]: { diffuseColor: "#F5121216", lightingModel: "Constant" },
      [name]: {
        diffuseColor: variant === "glass" ? "#CC3A3A46" : "#F22E2E38",
        lightingModel: "Constant",
      },
    });
    return name;
  }, [contentMaterial, variant]);

  // ponytail: externalTexture binding is wired by a sibling <ViroGPUTexture> that the caller
  // composes — see doc/OffscreenRender.md. We expose the material name so they can target it.
  // Reading the texture handle here just lets us assert it stays defined for the slate's lifetime.
  useEffect(() => {
    if (externalTexture && externalTexture.width === 0) {
      props.onError?.(new Error("ViroSlate: externalTexture has zero width"));
    }
  }, [externalTexture, props]);

  const titleBarHeight = heightMeters * 0.06;
  const titleBarY = heightMeters / 2 + titleBarHeight / 2;

  const contentMesh = useMemo(
    () => (curvature > 0 ? curvedBuffers(widthMeters, heightMeters, curvature) : null),
    [curvature, widthMeters, heightMeters]
  );

  const contentSurface = contentMesh ? (
    <ViroGeometry
      vertices={contentMesh.vertices}
      normals={contentMesh.normals}
      texcoords={contentMesh.texcoords}
      triangleIndices={contentMesh.triangleIndices}
      materials={[contentMaterial]}
      ignoreEventHandling
    />
  ) : (
    <ViroQuad
      width={widthMeters}
      height={heightMeters}
      materials={[contentMaterial]}
      ignoreEventHandling
    />
  );

  // Title bar is the grab AFFORDANCE only — the drag itself lives on the
  // root MovableNode, so grabbing the bar moves the WHOLE slate (Babylon
  // HolographicSlate semantics). Viro bubbles the drag from the hit quad up
  // to the nearest ancestor with onDrag.
  const titleBar = title !== undefined ? (
    <ViroNode position={[0, titleBarY, 0]}>
      <ViroQuad width={widthMeters} height={titleBarHeight} materials={[chromeMaterial]} />
      <ViroText
        text={title}
        color="#EDEDF2"
        width={widthMeters * 0.9}
        height={titleBarHeight}
        position={[0, 0, 0.002]}
        style={{ textAlign: "left", textAlignVertical: "center", fontWeight: "600" }}
      />
    </ViroNode>
  ) : null;

  return (
    <MovableNode
      movable={movable}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
      position={position}
      scale={scale}
    >
      <ViroNode rotation={rotation}>
        {contentSurface}
        {titleBar}
      </ViroNode>
    </MovableNode>
  );
}

export const ViroSlateMaterialNames = {
  /** Helper for callers wiring a <ViroGPUTexture> sibling: returns the material name for the slate's content surface. */
  contentMaterialFor(slateId: number): string {
    return `viroSlate_content_${slateId}`;
  },
};
