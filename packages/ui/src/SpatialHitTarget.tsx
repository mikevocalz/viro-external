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
      // Additive black is visually inert but remains hit-testable on Viro forks
      // that cull fully transparent geometry from the interaction pass.
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
  z?: number;
  /** Extra invisible interaction area around the visual control, in meters. */
  padding?: number;
  disabled?: boolean;
  debug?: boolean;
  onHover?: (hovered: boolean) => void;
  onClick?: () => void;
  onDrag?: (position: number[]) => void;
  children?: React.ReactNode;
};

/**
 * A reusable XR interaction surface.
 *
 * The target owns the interaction geometry rather than making every media
 * control invent its own invisible quad. It deliberately does not write
 * depth, and it can be oversized without changing the visual layout.
 */
export function SpatialHitTarget(props: SpatialHitTargetProps): React.ReactElement {
  registerMaterial();
  const [hovered, setHovered] = useState(false);
  const padding = Math.max(0, props.padding ?? 0);
  const active = !props.disabled;

  return (
    <ViroNode
      position={props.position}
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
