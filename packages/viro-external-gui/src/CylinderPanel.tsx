import React, { useCallback } from "react";
import { MovableNode, type MovableProps, type Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { Container3D, type ArrangedChild } from "./Container3D";
import { MovablePanelContext } from "./MovablePanelContext";

export type VolumeOrientation =
  | "FACEORIGIN_ORIENTATION"
  | "FACEORIGIN_REVERSED"
  | "FACEFORWARD_ORIENTATION"
  | "FACEFORWARD_REVERSED";

export interface CylinderPanelProps extends MovableProps {
  radius?: number;
  margin?: number;
  columns?: number;
  rows?: number;
  orientation?: VolumeOrientation;
  /** Per-item width/height (meters). Defaults to button defaults. */
  itemWidth?: number;
  itemHeight?: number;
  blockLayout?: boolean;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children: React.ReactNode;
}

function degrees(rad: number) { return rad * (180 / Math.PI); }
function radians(deg: number) { return deg * (Math.PI / 180); }

interface ArcLayout {
  arcDegrees: number;
  stepDegrees: number;
}

export function deriveCylinderArc(opts: {
  radius: number;
  itemWidth: number;
  columns: number;
  marginRadians: number;
}): ArcLayout {
  const { radius, itemWidth, columns, marginRadians } = opts;
  if (itemWidth >= 2 * radius) {
    throw new Error("CylinderPanel: itemWidth must be < 2 * radius");
  }
  const stepRad = 2 * Math.asin(itemWidth / (2 * radius)) + marginRadians;
  const stepDeg = degrees(stepRad);
  const arcDeg = columns * stepDeg;
  if (arcDeg > 360) {
    throw new Error(
      `CylinderPanel: over-subscribed — ${columns} columns at radius ${radius} need ` +
        `${arcDeg.toFixed(1)}° (max 360°). Increase radius, reduce columns, or shrink itemWidth.`
    );
  }
  return { arcDegrees: arcDeg, stepDegrees: stepDeg };
}

export function CylinderPanel(props: CylinderPanelProps): React.ReactElement {
  const {
    radius = defaults.cylinderPanel.radius,
    margin = defaults.cylinderPanel.margin,
    columns = defaults.cylinderPanel.columns,
    rows = defaults.cylinderPanel.rows,
    orientation = defaults.cylinderPanel.orientation as VolumeOrientation,
    itemWidth = defaults.button.widthMeters,
    itemHeight = defaults.button.heightMeters,
    blockLayout,
    position,
    rotation,
    scale,
    movable,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    children,
  } = props;

  const { arcDegrees, stepDegrees } = deriveCylinderArc({
    radius,
    itemWidth,
    columns,
    marginRadians: margin / radius, // margin meters → radians at given radius
  });

  const arrange = useCallback(
    (kids: React.ReactNode[]): ArrangedChild[] => {
      const out: ArrangedChild[] = [];
      for (let i = 0; i < kids.length; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        if (row >= rows) break; // overflow children are silently dropped at the layout boundary
        const thetaDeg = -arcDegrees / 2 + (col + 0.5) * stepDegrees;
        const thetaRad = radians(thetaDeg);
        const y = ((rows - 1) / 2) * (itemHeight + margin) - row * (itemHeight + margin);
        const pos: Vec3 = [radius * Math.sin(thetaRad), y, -radius * Math.cos(thetaRad)];

        let facingDeg = 0;
        switch (orientation) {
          case "FACEORIGIN_ORIENTATION":
            facingDeg = thetaDeg;
            break;
          case "FACEORIGIN_REVERSED":
            facingDeg = thetaDeg + 180;
            break;
          case "FACEFORWARD_ORIENTATION":
            facingDeg = 0;
            break;
          case "FACEFORWARD_REVERSED":
            facingDeg = 180;
            break;
        }
        out.push({ child: kids[i], position: pos, rotation: [0, facingDeg, 0] });
      }
      return out;
    },
    [arcDegrees, stepDegrees, columns, rows, radius, itemHeight, margin, orientation]
  );

  return (
    <MovableNode
      movable={movable}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
      position={position}
      scale={scale}
    >
      <MovablePanelContext.Provider value={!!movable}>
        <Container3D blockLayout={blockLayout} arrange={arrange} rotation={rotation}>
          {children}
        </Container3D>
      </MovablePanelContext.Provider>
    </MovableNode>
  );
}

// Self-check.
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const a = deriveCylinderArc({ radius: 1, itemWidth: 0.18, columns: 6, marginRadians: 0.04 });
  console.assert(a.stepDegrees > 0 && a.arcDegrees <= 360, "arc within bounds");
  let threw = false;
  try { deriveCylinderArc({ radius: 0.1, itemWidth: 0.18, columns: 6, marginRadians: 0.04 }); } catch { threw = true; }
  console.assert(threw, "should throw when over-subscribed");
}
