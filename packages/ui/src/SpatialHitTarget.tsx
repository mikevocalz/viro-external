import React, { useState } from "react";
import { ViroMaterials, ViroNode, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";

let registered = false;
const MATERIAL = "vxg_spatial_hit_target";

function registerMaterial(): void {
  if (registered) return;
  registered = true;
  ViroMaterials.createMaterials({
    [MATERIAL]: {
      diffuseColor: "#FF000000",
      lightingModel: "Constant",
      blendMode: "Add",
      writesToDepthBuffer: false,
    },
  });
}

export type SpatialHitTargetProps = {
  width: number;
  height: number;
  position?: Vec3;
  rotation?: Vec3;
  z?: number;
  padding?: number;
  disabled?: boolean;
  debug?: boolean;
  onHover?: (hovered: boolean) => void;
  onClick?: () => void;
  onDrag?: (position: number[]) => void;
  children?: React.ReactNode;
};

export function SpatialHitTarget(props: SpatialHitTargetProps): React.ReactElement {
  registerMaterial();
  const [hovered, setHovered] = useState(false);
  const padding = Math.max(0, props.padding ?? 0);
  const active = !props.disabled;

  return (
    <ViroNode
      position={props.position}
      rotation={props.rotation}
      dragType={"Gizmo" as never}
      onDrag={props.onDrag}
    >
      <ViroQuad
        width={props.width + padding * 2}
        height={props.height + padding * 2}
        position={[0, 0, props.z ?? 0.001]}
        materials={[MATERIAL]}
        onHover={
          active
            ? (value: boolean) => {
                setHovered(value);
                props.onHover?.(value);
              }
            : undefined
        }
        onClick={active ? props.onClick : undefined}
      />
      {props.debug && hovered ? (
        <ViroQuad
          width={props.width + padding * 2}
          height={props.height + padding * 2}
          position={[0, 0, (props.z ?? 0.001) + 0.0005]}
          materials={[MATERIAL]}
          opacity={0.08}
          ignoreEventHandling
        />
      ) : null}
      {props.children}
    </ViroNode>
  );
}
