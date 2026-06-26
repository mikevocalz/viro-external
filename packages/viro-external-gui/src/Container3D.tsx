import React, { useMemo } from "react";
import { ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";

export interface ArrangedChild {
  child: React.ReactNode;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

export interface ArrangeContext {
  count: number;
  index: number;
}

/**
 * Subclasses implement the layout policy via `arrange`. Babylon's `_arrangeChildren`
 * is the same hook.
 */
export interface Container3DProps {
  /** Babylon real prop: batch adds, arrange once. Carried as-is. */
  blockLayout?: boolean;
  arrange: (children: React.ReactNode[]) => ArrangedChild[];
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children: React.ReactNode;
}

function flatten(nodes: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(nodes);
}

export function Container3D(props: Container3DProps): React.ReactElement {
  const { blockLayout, arrange, position, rotation, scale, children } = props;

  // ponytail: blockLayout in our React port collapses to "compute once per arrange function identity".
  // Babylon used it to defer arrangement during programmatic batch-adds; React's render cycle is the batch.
  void blockLayout;

  const arranged = useMemo(() => arrange(flatten(children)), [arrange, children]);

  return (
    <ViroNode position={position} rotation={rotation} scale={scale}>
      {arranged.map((entry, i) => (
        <ViroNode key={i} position={entry.position} rotation={entry.rotation} scale={entry.scale}>
          {entry.child}
        </ViroNode>
      ))}
    </ViroNode>
  );
}
