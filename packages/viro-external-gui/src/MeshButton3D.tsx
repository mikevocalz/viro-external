import React from "react";
import { Viro3DObject } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import { Control3D, type Control3DProps } from "./Control3D";

type ImageSource = number | { uri: string };

export interface MeshButton3DProps extends Omit<Control3DProps, "children"> {
  /** GLB/GLTF/OBJ/VRX source — verified Viro3DObject `source` prop. */
  source: ImageSource;
  /** Verified Viro3DObject `type` — required. */
  type: "OBJ" | "VRX" | "GLTF" | "GLB";
  resources?: ImageSource[];
  materials?: string | string[];
  onLoadStart?: (event: unknown) => void;
  onLoadEnd?: (event: unknown) => void;
  onLoadError?: (event: unknown) => void;
}

/**
 * Babylon `MeshButton3D` — uses an arbitrary mesh as the button body. Composes
 * `Control3D` for pointer state + hover/press scale; the mesh is `Viro3DObject`.
 */
export function MeshButton3D(props: MeshButton3DProps): React.ReactElement {
  const {
    source,
    type,
    resources,
    materials,
    onLoadStart,
    onLoadEnd,
    onLoadError,
    position,
    rotation,
    scale,
    visible,
    onPointerEnter,
    onPointerOut,
    onPointerDown,
    onPointerUp,
    onPointerClick,
  } = props;

  const materialsArray =
    typeof materials === "string" ? [materials] : materials;

  return (
    <Control3D
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      onPointerEnter={onPointerEnter}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerClick={onPointerClick}
    >
      <Viro3DObject
        source={source}
        type={type}
        resources={resources}
        materials={materialsArray}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onError={onLoadError}
      />
    </Control3D>
  );
}
