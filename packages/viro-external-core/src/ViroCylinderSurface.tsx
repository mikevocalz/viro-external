import React, { useMemo } from "react";
import { ViroGeometry } from "@reactvision/react-viro";
import { MovableNode } from "./MovableNode";
import type { MovableProps, Vec3 } from "./spatialTypes";
import defaults from "../config/defaults.json";
import { buildCylinderGeometry, type CylinderGeometryBuffers } from "./buildCylinderGeometry";

export interface ViroCylinderSurfaceProps extends MovableProps {
  height?: number;
  radiusTop?: number;
  radiusBottom?: number;
  radialSegments?: number;
  heightSegments?: number;
  openEnded?: boolean;
  thetaStart?: number;
  thetaLength?: number;
  /**
   * Named material this cylinder displays. Texture binding is the responsibility of
   * a sibling <ViroGPUTexture materialName={...} /> (or <ViroMuxSurface/>) component.
   * Keep this component geometry-only.
   */
  materialName: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

function toTuple3Array(buf: Float32Array): [number, number, number][] {
  const out: [number, number, number][] = new Array(buf.length / 3);
  for (let i = 0; i < buf.length; i += 3) {
    out[i / 3] = [buf[i]!, buf[i + 1]!, buf[i + 2]!];
  }
  return out;
}

function toTuple2Array(buf: Float32Array): [number, number][] {
  const out: [number, number][] = new Array(buf.length / 2);
  for (let i = 0; i < buf.length; i += 2) {
    out[i / 2] = [buf[i]!, buf[i + 1]!];
  }
  return out;
}

function indicesToTriangles(idx: Uint32Array): [number, number, number][] {
  const out: [number, number, number][] = new Array(idx.length / 3);
  for (let i = 0; i < idx.length; i += 3) {
    out[i / 3] = [idx[i]!, idx[i + 1]!, idx[i + 2]!];
  }
  return out;
}

function bufferToViroArrays(buffers: CylinderGeometryBuffers) {
  return {
    vertices: toTuple3Array(buffers.positions),
    normals: toTuple3Array(buffers.normals),
    texcoords: toTuple2Array(buffers.uvs),
    triangleIndices: indicesToTriangles(buffers.indices),
  };
}

export function ViroCylinderSurface(props: ViroCylinderSurfaceProps): React.ReactElement {
  const {
    height = defaults.cylinder.height,
    radiusTop = defaults.cylinder.radiusTop,
    radiusBottom = defaults.cylinder.radiusBottom,
    radialSegments = defaults.cylinder.radialSegments,
    heightSegments = defaults.cylinder.heightSegments,
    openEnded = defaults.cylinder.openEnded,
    thetaStart = defaults.cylinder.thetaStart,
    thetaLength = defaults.cylinder.thetaLength,
    materialName,
    position,
    rotation,
    scale,
    // MovableProps
    movable,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
  } = props;

  const viroBuffers = useMemo(
    () =>
      bufferToViroArrays(
        buildCylinderGeometry({
          height, radiusTop, radiusBottom,
          radialSegments, heightSegments,
          thetaStart, thetaLength, openEnded,
        })
      ),
    [height, radiusTop, radiusBottom, radialSegments, heightSegments, thetaStart, thetaLength, openEnded]
  );

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
      <ViroGeometry
        rotation={rotation}
        vertices={viroBuffers.vertices}
        normals={viroBuffers.normals}
        texcoords={viroBuffers.texcoords}
        triangleIndices={viroBuffers.triangleIndices}
        materials={[materialName]}
      />
    </MovableNode>
  );
}
