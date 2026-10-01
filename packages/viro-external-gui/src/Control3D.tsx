import React, { useCallback, useState } from "react";
import { ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";

export interface PointerEvent {
  position: [number, number, number];
}

export interface Control3DProps {
  position?: Vec3;
  scale?: Vec3;
  rotation?: Vec3;
  visible?: boolean;
  onPointerEnter?: (event: PointerEvent) => void;
  onPointerOut?: () => void;
  onPointerDown?: (event: PointerEvent) => void;
  onPointerUp?: (event: PointerEvent) => void;
  onPointerClick?: (event: PointerEvent) => void;
  children: React.ReactNode;
}

const CLICK_DOWN = 1;
const CLICK_UP = 2;
const CLICKED = 3;

/**
 * Base spatial control. Owns pointer state (hover/press), Babylon-style observable
 * equivalents (as React callbacks), and the semantic state animation (scale only —
 * material response is a Wave 2 extension).
 *
 * Pointer events wired through Viro's verified onHover / onClickState / onClick.
 */
export function Control3D(props: Control3DProps): React.ReactElement {
  const {
    position,
    scale,
    rotation,
    visible = true,
    onPointerEnter,
    onPointerOut,
    onPointerDown,
    onPointerUp,
    onPointerClick,
    children,
  } = props;

  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handleHover = useCallback(
    (isHovering: boolean, hoverPos: [number, number, number]) => {
      if (isHovering) {
        if (!hovered) {
          setHovered(true);
          onPointerEnter?.({ position: hoverPos });
        }
      } else if (hovered) {
        setHovered(false);
        onPointerOut?.();
      }
    },
    [hovered, onPointerEnter, onPointerOut]
  );

  const handleClickState = useCallback(
    (clickState: number, position: [number, number, number]) => {
      if (clickState === CLICK_DOWN) {
        setPressed(true);
        onPointerDown?.({ position });
      } else if (clickState === CLICK_UP) {
        setPressed(false);
        onPointerUp?.({ position });
      } else if (clickState === CLICKED) {
        onPointerClick?.({ position });
      }
    },
    [onPointerDown, onPointerUp, onPointerClick]
  );

  const stateScale = pressed
    ? defaults.control.pressScale
    : hovered
    ? defaults.control.hoverScale
    : 1;
  const baseScale: Vec3 = scale ?? [1, 1, 1];
  const effectiveScale: Vec3 = [
    baseScale[0] * stateScale,
    baseScale[1] * stateScale,
    baseScale[2] * stateScale,
  ];

  if (!visible) return <></>;

  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={effectiveScale}
      onHover={handleHover}
      onClickState={handleClickState}
    >
      {children}
    </ViroNode>
  );
}
