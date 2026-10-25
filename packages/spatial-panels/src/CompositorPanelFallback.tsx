import { ViroGeometry, ViroNode, ViroQuad } from "@reactvision/react-viro";
import { useMemo, type ComponentProps } from "react";
import { useStore } from "zustand";

import type { CompositorPanelHandle } from "./CompositorPanelHandle";
import { cylinderArcMesh } from "./fallback/cylinderArcMesh";
import { quaternionToViroEulerDegrees } from "./fallback/quaternionToViroEulerDegrees";

/** Props of {@link CompositorPanelFallback}. */
export interface CompositorPanelFallbackProps {
  /** The panel whose layer this mesh stands in for. */
  readonly panel: CompositorPanelHandle;
}

// The fallback texture stores rows bottom-up, so the top edge samples v = 1.
// The bridge reads four numbers u0, v0, u1, v1 (VRTQuadManager.setUVCoordinates);
// ViroQuad's prop type declares an array of tuples, so the value is cast.
const QUAD_UV = [0, 1, 1, 0] as unknown as NonNullable<ComponentProps<typeof ViroQuad>["uvCoordinates"]>;

/**
 * The scene stand-in of a compositor panel: a quad or cylinder arc with the
 * panel's pose and size and its fallback material. Visible only while the
 * layer is evicted and the fallback texture is bound; hidden again as soon as
 * the compositor takes the panel back. Mount it at the scene root so its pose
 * is in world space, the frame the layer pose uses.
 */
export function CompositorPanelFallback({ panel }: CompositorPanelFallbackProps) {
  const state = useStore(panel.fallback);
  const rotation = useMemo(() => quaternionToViroEulerDegrees(state.pose.orientation), [state.pose.orientation]);
  const arc = useMemo(
    () => (state.shape === "cylinder" ? cylinderArcMesh(state.widthM, state.heightM, state.cylinderRadiusM) : null),
    [state.shape, state.widthM, state.heightM, state.cylinderRadiusM],
  );
  if (state.isDisposed || !state.isSceneAllowed) return null;
  const position: [number, number, number] = [...state.pose.position];
  if (arc) {
    return (
      <ViroNode position={position} rotation={rotation} visible={state.isFallbackVisible}>
        <ViroGeometry
          vertices={arc.vertices}
          normals={arc.normals}
          texcoords={arc.texcoords}
          triangleIndices={arc.triangleIndices}
          materials={[state.materialName]}
        />
      </ViroNode>
    );
  }
  return (
    <ViroQuad
      position={position}
      rotation={rotation}
      width={state.widthM}
      height={state.heightM}
      uvCoordinates={QUAD_UV}
      materials={[state.materialName]}
      visible={state.isFallbackVisible}
    />
  );
}
