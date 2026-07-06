import React, { useCallback, useState } from "react";
import { ViroNode } from "@reactvision/react-viro";
import { MovableNode, type MovableProps, type Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { Container3D, type ArrangedChild } from "./Container3D";
import { MovablePanelContext } from "./MovablePanelContext";
import { PanelHeader3D } from "./PanelHeader3D";

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
  /** Optional PanelHeader3D floating above the arc (title bar + pin + close). */
  title?: string;
  titleFontFamily?: string;
  /** Called when the header's close button hides the panel. */
  onClose?: () => void;
  /** Pinned = fixed in place; unpinned = billboardY toward the user. */
  defaultPinned?: boolean;
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
    title,
    titleFontFamily,
    onClose,
    defaultPinned = true,
    position,
    rotation,
    scale,
    movable,
    tag,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    children,
  } = props;

  const [pinned, setPinned] = useState(defaultPinned);
  const [closed, setClosed] = useState(false);

  const { arcDegrees, stepDegrees } = deriveCylinderArc({
    radius,
    itemWidth,
    columns,
    marginRadians: margin / radius, // margin meters → radians at given radius
  });

  // Header chrome above the arc, sitting at the arc's front face (cells lie
  // at z = -radius·cosθ, so the front face is local z = -radius — the plane
  // consumers pull to their anchor with position [0, 0, radius]).
  const barH = Math.max(
    defaults.holographicSlate.titleBarHeightMeters,
    itemHeight * 0.4
  );
  const headerW = Math.min(
    2 * radius * Math.sin(radians(arcDegrees) / 2), // arc chord
    columns * (itemWidth + margin)
  );
  const headerY = (rows * itemHeight) / 2 + margin + barH;

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

        // Cell sits at [r·sinθ, y, -r·cosθ]. A node yawed by φ has its +z
        // normal at [sinφ, 0, cosφ]; facing the cylinder axis (the user)
        // needs the normal at [-sinθ, 0, cosθ] → φ = -θ. (+θ was the
        // "buttons point sideways" bug: off-center cells turned AWAY by 2θ.)
        let facingDeg = 0;
        switch (orientation) {
          case "FACEORIGIN_ORIENTATION":
            facingDeg = -thetaDeg;
            break;
          case "FACEORIGIN_REVERSED":
            facingDeg = -thetaDeg + 180;
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

  if (closed) return <ViroNode />;

  return (
    <MovableNode
      movable={movable}
      tag={tag}
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
      {/* Panel body — billboardY toward the user while unpinned (header pin). */}
      <ViroNode rotation={rotation} transformBehaviors={pinned ? undefined : ["billboardY"]}>
        <MovablePanelContext.Provider value={!!movable}>
          {title !== undefined && (
            <PanelHeader3D
              width={headerW}
              barHeight={barH}
              title={title}
              titleFontFamily={titleFontFamily}
              pinned={pinned}
              onTogglePin={() => setPinned((p) => !p)}
              onClose={() => {
                setClosed(true);
                onClose?.();
              }}
              position={[0, headerY, -radius]}
            />
          )}
          <Container3D blockLayout={blockLayout} arrange={arrange}>
            {children}
          </Container3D>
        </MovablePanelContext.Provider>
      </ViroNode>
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
