import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ViroAnimatedImage,
  ViroNode,
  ViroQuad,
  ViroRivePanel,
  type ViroRivePanelProps,
} from "@reactvision/react-viro";
import { MovableNode, type Vec3 } from "@viro-external/core";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";

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
 * renders clips from `file` and the Lens plays them as a small state graph.
 *
 * Rive files differ by repo and by how they were made, so the build reads
 * what each file contains: its artboard size and animations from the Rive
 * runtime, and its buttons (the shapes its listeners hit) from the RML
 * project via `rive inspect`. Anything set here overrides what was read.
 */
export type RiveSpecsProps = {
  /** The .riv file, relative to the scene file. */
  file: string;
  artboard?: string;
  /**
   * Where to read buttons from: an RML project directory (runs `rive
   * inspect`), or a saved `rive inspect --json` output. Relative to the
   * scene file. Without either, the panel has no button targets unless
   * `buttons` lists them.
   */
  project?: string;
  inspect?: string;
  /** Clips to bake. Defaults to every animation in the artboard, with its own loop mode. */
  clips?: Record<string, RiveSpecsClip>;
  /** First clip. Defaults to the first looping clip, else the first clip. */
  play?: string;
  next?: Record<string, string>;
  onSelect?: Record<string, string>;
  /** Buttons by hand, overriding discovery. */
  buttons?: RiveButton[];
  /** Which clip each button plays, by button id ("submit", "retry"). */
  actions?: Record<string, string>;
  /** Baked frame width in pixels. */
  resolution?: number;
  /** Cap on frames baked when clips are discovered. */
  maxFrames?: number;
};

/** A button after baking: hit area 0-1 of the artboard from its top-left. */
export type RiveBakedButton = {
  id: string;
  label: string;
  rect: [number, number, number, number];
  play?: string;
};

/**
 * A Rive panel baked by `pnpm specs:bake-rive-native`: one GIF per clip plus
 * the same state graph and buttons the Specs build uses.
 */
export type RiveBaked = {
  /** Artboard width over height. */
  aspect: number;
  clips: Record<string, { source: number | { uri: string }; loop: boolean; durationMs: number }>;
  play: string;
  next: Record<string, string>;
  onSelect: Record<string, string>;
  buttons: RiveBakedButton[];
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
  /**
   * Live Rive: the source and bindings for ViroRivePanel, which needs
   * nitro-canvas-in-Vision. Used when `baked` is not given.
   */
  rive?: RiveNativeProps;
  /**
   * Baked Rive from `pnpm specs:bake-rive-native`: the same clips, state graph
   * and buttons as on Specs, played without the canvas runtime.
   */
  baked?: RiveBaked;
  /** Called with a button id when one of the Rive file's buttons is pressed (baked). */
  onButtonPress?: (id: string) => void;
  specs?: RiveSpecsProps;
};

/**
 * A Rive file as a spatial panel, with no chrome of its own: the art carries
 * its header and buttons. With `baked` it plays the clips the build rendered,
 * through the same state graph Specs uses; otherwise ViroRivePanel renders
 * the file live with its bindings and listeners.
 */
export function RivePanel({
  tag,
  width = 1.2,
  height = 0.75,
  position,
  rotation,
  draggable = true,
  rive,
  baked,
  onButtonPress,
}: RivePanelProps): React.ReactElement {
  return (
    <MovableNode movable={draggable} tag={tag ?? "vxp-rive-panel"} position={position}>
      {baked ? (
        <BakedRive baked={baked} width={width} height={height} rotation={rotation} onButtonPress={onButtonPress} />
      ) : rive ? (
        <ViroRivePanel
          {...(rive as ViroRivePanelProps)}
          width={width}
          height={height}
          position={[0, 0, 0]}
          rotation={rotation}
        />
      ) : (
        <ViroNode />
      )}
    </MovableNode>
  );
}

/**
 * The baked player: one ViroAnimatedImage showing the current clip's GIF.
 * Same rules as the Specs runtime: a looping clip repeats, a one-shot clip
 * moves to `next` when it ends, a pinch on the art moves by `onSelect`, a
 * button plays its clip.
 */
function BakedRive({
  baked,
  width,
  height,
  rotation,
  onButtonPress,
}: {
  baked: RiveBaked;
  width: number;
  height: number;
  rotation?: Vec3;
  onButtonPress?: (id: string) => void;
}): React.ReactElement {
  registerPremiumMaterials();
  const [clip, setClip] = useState(baked.play);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = baked.clips[clip];

  // ViroAnimatedImage reports no end of playback, so a one-shot clip hands
  // over to `next` after its baked length.
  useEffect(() => {
    if (!current || current.loop) return;
    const following = baked.next[clip];
    if (!following) return;
    timer.current = setTimeout(() => setClip(following), current.durationMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [baked.next, clip, current]);

  const play = useCallback(
    (name: string | undefined) => {
      if (name && baked.clips[name]) setClip(name);
    },
    [baked.clips]
  );

  // Fit the art inside the panel at its own aspect.
  const artWidth = Math.min(width, height * baked.aspect);
  const artHeight = artWidth / baked.aspect;

  return (
    <ViroNode rotation={rotation}>
      {current ? (
        <ViroAnimatedImage
          key={clip}
          source={current.source as never}
          width={artWidth}
          height={artHeight}
          loop={current.loop}
          onClick={() => play(baked.onSelect[clip])}
        />
      ) : null}
      {baked.buttons.map((button) => {
        const [x, y, w, h] = button.rect;
        const lit = pressed === button.id ? 0.28 : hovered === button.id ? 0.14 : 0;
        return (
          <ViroQuad
            key={button.id}
            viroTag={"viro-button:" + button.label}
            position={[
              (x + w / 2 - 0.5) * artWidth,
              (0.5 - (y + h / 2)) * artHeight,
              pressed === button.id ? 0.0005 : 0.002,
            ]}
            width={w * artWidth}
            height={h * artHeight}
            materials={[PremiumMaterials.thumb]}
            opacity={lit}
            onHover={(isHovering: boolean) => setHovered(isHovering ? button.id : null)}
            onClickState={(state: number) => {
              // Viro click states: 1 down, 2 up, 3 clicked.
              if (state === 1) setPressed(button.id);
              if (state === 2) setPressed(null);
              if (state === 3) {
                play(button.play);
                onButtonPress?.(button.id);
              }
            }}
          />
        );
      })}
    </ViroNode>
  );
}
