import React from "react";
import { ViroAnimations, ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";

/**
 * Mount-presence wrapper: children fade + scale in once on mount
 * (opacity 0.15→1, scale 0.85→1, 350ms EaseOut). Stagger a set of panels
 * with `delayMs`. Reanimated cannot drive Viro nodes — this is a registered
 * ViroAnimations entry animated natively from the node's initial props.
 * Initial opacity is 0.15, not 0 — opacity-0 nodes are hit-test-culled.
 */
export interface Reveal3DProps {
  /** Delay before the reveal starts (stagger), ms. */
  delayMs?: number;
  position?: Vec3;
  children: React.ReactNode;
}

let revealRegistered = false;
function registerRevealAnim(): void {
  if (revealRegistered) return;
  revealRegistered = true;
  ViroAnimations.registerAnimations({
    vxgReveal: {
      properties: { opacity: 1, scaleX: 1, scaleY: 1, scaleZ: 1 },
      duration: 350,
      easing: "EaseOut",
    },
  });
}

export function Reveal3D(props: Reveal3DProps): React.ReactElement {
  const { delayMs = 0, position, children } = props;
  registerRevealAnim();
  return (
    <ViroNode
      position={position}
      opacity={0.15}
      scale={[0.85, 0.85, 0.85]}
      animation={{ name: "vxgReveal", run: true, loop: false, delay: delayMs }}
    >
      {children}
    </ViroNode>
  );
}
