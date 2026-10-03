import React from "react";
import { ViroRivePanel, type ViroRivePanelProps } from "@reactvision/react-viro";
import { MovableNode, type Vec3 } from "@viro-external/core";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What the native Rive panel needs; geometry comes from the RivePanel. */
export type RiveNativeProps = DistributiveOmit<
  ViroRivePanelProps,
  "width" | "height" | "position" | "rotation"
>;

/** A clip baked for hosts that cannot run Rive: an animation name, optionally looping. */
export type RiveSpecsClip = string | { animation: string; loop?: boolean };

/**
 * A button the Rive art draws. Natively the Rive file's own listeners handle
 * it; where the art is baked, it becomes a labelled press target.
 */
export type RiveButton = {
  id: string;
  /** Spoken and shown label. */
  label: string;
  /** Hit area as [x, y, width, height] in artboard pixels, from the top-left. */
  rect: [number, number, number, number];
  /** Baked clip to play when pressed. */
  play?: string;
};

/**
 * How the panel plays on Specs. Specs Lenses cannot run Rive, so the build
 * renders these clips from `file` and the Lens plays them as a small state
 * graph: `play` first, `next` when a clip ends, `onSelect` on pinch.
 */
export type RiveSpecsProps = {
  /** The .riv file, relative to the scene file. */
  file: string;
  artboard?: string;
  clips: Record<string, RiveSpecsClip>;
  play: string;
  next?: Record<string, string>;
  onSelect?: Record<string, string>;
  buttons?: RiveButton[];
  /** Artboard size in pixels, which `buttons` rects are measured against. */
  artboardSize: [number, number];
  /** Baked frame width in pixels. */
  resolution?: number;
};

export type RivePanelProps = {
  /** Stable id for the panel in the Specs scene. */
  tag?: string;
  width?: number;
  height?: number;
  position?: Vec3;
  rotation?: Vec3;
  /** Pinch to move it. The Rive file draws its own header and controls. */
  draggable?: boolean;
  /** The native Rive source and its bindings, passed to ViroRivePanel. */
  rive: RiveNativeProps;
  specs?: RiveSpecsProps;
};

/**
 * A Rive file as a spatial panel, with no chrome of its own: the art carries
 * its header and buttons. Natively the Rive runtime renders it live with its
 * bindings and listeners; on Specs it plays the baked clips in `specs`.
 */
export function RivePanel({
  tag,
  width = 1.2,
  height = 0.75,
  position,
  rotation,
  draggable = true,
  rive,
}: RivePanelProps): React.ReactElement {
  return (
    <MovableNode movable={draggable} tag={tag ?? "vxp-rive-panel"} position={position}>
      <ViroRivePanel
        {...(rive as ViroRivePanelProps)}
        width={width}
        height={height}
        position={[0, 0, 0]}
        rotation={rotation}
      />
    </MovableNode>
  );
}
