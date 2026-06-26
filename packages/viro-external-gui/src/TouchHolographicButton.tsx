import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Vec3 } from "react-native-viro-mux";
import { HolographicButton, type HolographicButtonProps } from "./HolographicButton";
import defaults from "../config/defaults.json";

export interface TouchHolographicButtonProps extends HolographicButtonProps {
  /** Push depth in meters when the front plate is poked. */
  pushDepth?: number;
  /**
   * `collisionMesh` and `collidableFrontDirection` are Babylon TouchButton3D props.
   * Near-field poke input is not reachable through the prebuilt ViroReact renderer
   * — see doc/Controls-Wave2.md. These props are carried for API parity; the press
   * animation here is driven by ray onClickState until a touch-enabled renderer
   * lands. This is a capability limit, not a quality fallback.
   */
  collisionMesh?: unknown;
  collidableFrontDirection?: Vec3;
}

const PRESS_HOLD_MS = 80;

export function TouchHolographicButton(props: TouchHolographicButtonProps): React.ReactElement {
  const {
    pushDepth = 0.012,
    collisionMesh,
    collidableFrontDirection,
    onPointerDown,
    onPointerUp,
    ...rest
  } = props;

  void collisionMesh;
  void collidableFrontDirection;

  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleDown = useCallback(
    (e: { position: Vec3 }) => {
      setPressed(true);
      onPointerDown?.(e);
    },
    [onPointerDown]
  );

  const handleUp = useCallback(
    (e: { position: Vec3 }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setPressed(false), PRESS_HOLD_MS);
      onPointerUp?.(e);
    },
    [onPointerUp]
  );

  const offset = pressed ? -pushDepth : 0;

  // ponytail: we translate the WHOLE control on Z via the inherited `position` prop;
  // the HolographicButton's internal back/front plates are static relative to this node.
  const basePos = props.position ?? [0, 0, 0];
  const effectivePosition: Vec3 = [basePos[0], basePos[1], basePos[2] + offset];

  void defaults; // tunables can move into config when a real touch input surface lands

  return (
    <HolographicButton
      {...rest}
      position={effectivePosition}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
    />
  );
}
