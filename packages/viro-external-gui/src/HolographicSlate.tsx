import React, { useMemo, useState } from "react";
import { ViroGeometry, ViroMaterials, ViroNode } from "@reactvision/react-viro";
import { MovableNode, type MovableProps, type Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { roundedPlateBuffers, roundedBorderBuffers } from "./roundedPlate";
import { MovablePanelContext } from "./MovablePanelContext";
import { PanelHeader3D, registerHeaderAnims } from "./PanelHeader3D";

/**
 * Babylon.js `HolographicSlate` anatomy, Viro-native:
 *   border glow (hover-reactive) → backplate → content plate → title bar
 *   with title text, follow (pin) toggle, and close button.
 *
 * Whole-slate drag: any chrome surface is a grab handle — Viro bubbles the
 * drag up to the root MovableNode (native per-frame move, A-button on XR).
 * Follow: Babylon's FollowBehavior approximated with Viro's billboardY
 * transform behavior while unpinned. Resize gizmo deliberately deferred:
 * Viro's onDrag natively MOVES the handle node, which fights a resize
 * gesture — needs a native gizmo mode first.
 */
export interface HolographicSlateProps extends MovableProps {
  title?: string;
  titleFontFamily?: string;
  titleBarHeight?: number;
  titleBarMargin?: number;
  dimensions?: { width: number; height: number };
  minDimensions?: { width: number; height: number };
  renderingGroupId?: number;
  /** Name-addressable content material (external texture binds here later). */
  contentMaterialName?: string;
  /** Content plate opacity 0–1. Note: dark pixels wash out over passthrough — keep ≥0.8. */
  opacity?: number;
  /** Babylon FollowBehavior parity: pinned in place, or billboard toward the user. */
  defaultPinned?: boolean;
  onClose?: () => void;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children?: React.ReactNode;
}

let slateId = 0;

function RoundedLeg(props: { w: number; h: number; position: Vec3 }): React.ReactElement {
  const g = React.useMemo(
    () => roundedPlateBuffers(props.w, props.h, Math.min(props.w, props.h) / 2),
    [props.w, props.h]
  );
  return (
    <ViroGeometry
      vertices={g.vertices}
      normals={g.normals}
      texcoords={g.texcoords}
      triangleIndices={g.triangleIndices}
      materials={[FluentMaterials.gizmoHandle]}
      position={props.position}
    />
  );
}

/** Babylon slate gizmo: white L-corner. dragType Gizmo = report-only drag. */
function CornerHandle(props: {
  size: number;
  position: Vec3;
  /** 1 = grows when dragged outward on this corner's diagonal, -1 inverse. */
  flipX: number;
  flipY: number;
  onDragDelta: (dx: number, dy: number, phase: "start" | "move") => void;
}): React.ReactElement {
  const t = props.size * 0.22;             // bar thickness
  const L = props.size;                    // leg length
  const last = React.useRef<[number, number, number] | null>(null);
  return (
    <ViroNode
      position={props.position}
      dragType={"Gizmo" as never}
      onDrag={(pos: number[]) => {
        const p = pos as [number, number, number];
        if (!last.current) {
          last.current = p;
          console.log("[VXG] resize start");
          props.onDragDelta(0, 0, "start");
          return;
        }
        props.onDragDelta((p[0] - last.current[0]) * props.flipX, (p[1] - last.current[1]) * props.flipY, "move");
        last.current = p;
      }}
      onClickState={(state: number) => {
        if (state === 2) last.current = null;  // ClickUp resets the gesture
      }}
    >
      {/* L hugging the corner: rounded legs extend inward from the corner. */}
      <RoundedLeg w={L} h={t} position={[(-L / 2) * props.flipX, (-t / 2) * props.flipY, 0]} />
      <RoundedLeg w={t} h={L} position={[(-t / 2) * props.flipX, (-L / 2) * props.flipY, 0]} />
    </ViroNode>
  );
}

export function HolographicSlate(props: HolographicSlateProps): React.ReactElement {
  const {
    title,
    titleFontFamily,
    titleBarHeight = defaults.holographicSlate.titleBarHeightMeters,
    titleBarMargin = defaults.holographicSlate.titleBarMargin,
    dimensions = defaults.holographicSlate.dimensions,
    contentMaterialName,
    opacity = 1,
    defaultPinned = true,
    onClose,
    position,
    rotation,
    scale,
    movable = true,
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

  registerFluentMaterials();
  registerHeaderAnims();

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(defaultPinned);
  const [closed, setClosed] = useState(false);
  // Resize via corner gizmo handles (Babylon slate gizmo). Native dragType
  // "Gizmo" reports drag positions WITHOUT moving the handle node, so the
  // handle stays glued to its corner while JS scales the slate.
  const [userScale, setUserScale] = useState(1);
  const resizeStart = React.useRef<{ pos: [number, number, number]; scale: number } | null>(null);

  const { width, height } = dimensions;
  const corner = Math.min(width, height) * 0.02;
  // Title bar scales with the slate — an absolute 5cm bar disappears on a
  // 1.6m slate. Buttons follow the bar.
  const barH = Math.max(titleBarHeight, height * 0.1);

  // Content material — unique per slate so an external texture can rebind it.
  // Solid color; translucency comes from the node-level `opacity` prop below
  // (material diffuse alpha is unreliably composited on this fork).
  const contentMat = useMemo(() => {
    const name = contentMaterialName ?? `vxg_slate_content_${++slateId}`;
    ViroMaterials.createMaterials({
      [name]: { diffuseColor: "#FF23232B", lightingModel: "Constant" },
    });
    return name;
  }, [contentMaterialName]);

  const backplate = useMemo(
    () => roundedPlateBuffers(width + 0.02, height + 0.02, corner + 0.01),
    [width, height, corner]
  );
  const content = useMemo(
    () => roundedPlateBuffers(width - 0.02, height - 0.02, corner),
    [width, height, corner]
  );
  const border = useMemo(
    () => roundedBorderBuffers(width + 0.02, height + 0.02, corner + 0.01, 0.006),
    [width, height, corner]
  );
  const barW = width + 0.02;
  const barY = height / 2 + titleBarMargin + barH / 2 + 0.01;

  if (closed) return <ViroNode />;

  return (
    <MovableNode
      movable={movable}
      tag={tag ?? "vxg-slate"}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
      position={position}
      scale={scale ? [scale[0] * userScale, scale[1] * userScale, scale[2] * userScale] : [userScale, userScale, userScale]}
    >
      <ViroNode
        rotation={rotation}
        transformBehaviors={pinned ? undefined : ["billboardY"]}
      >
        {/* Border glow — flares on hover, MRTK blue. */}
        <ViroGeometry
          vertices={border.vertices}
          normals={border.normals}
          texcoords={border.texcoords}
          triangleIndices={border.triangleIndices}
          materials={[hovered ? FluentMaterials.borderHover : FluentMaterials.borderIdle]}
          position={[0, 0, -0.006]}
          ignoreEventHandling
        />
        {/* Backplate — also the grab surface (drag bubbles to the root). */}
        <ViroGeometry
          vertices={backplate.vertices}
          normals={backplate.normals}
          texcoords={backplate.texcoords}
          triangleIndices={backplate.triangleIndices}
          materials={[FluentMaterials.slateChrome]}
          position={[0, 0, -0.003]}
          onHover={(h: boolean) => {
            // TEMP-PROBE: on-device verdict for "is ViroGeometry hit-testable".
            setHovered(h);
          }}
        />
        {/* Content plate — name-addressable for external textures. */}
        <ViroGeometry
          vertices={content.vertices}
          normals={content.normals}
          texcoords={content.texcoords}
          triangleIndices={content.triangleIndices}
          materials={[contentMat]}
          opacity={Math.min(1, Math.max(0, opacity))}
          ignoreEventHandling
        />
        {children ? (
          <MovablePanelContext.Provider value={!!movable}>
            <ViroNode position={[0, 0, 0.004]}>{children}</ViroNode>
          </MovablePanelContext.Provider>
        ) : null}

        {/* Title bar — grab handle + title + follow/close controls. */}
        <PanelHeader3D
          width={barW}
          barHeight={barH}
          title={title}
          titleFontFamily={titleFontFamily}
          pinned={pinned}
          onTogglePin={() => setPinned((p) => !p)}
          onClose={() => {
            setClosed(true);
            onClose?.();
          }}
          onHover={setHovered}
          position={[0, barY, 0]}
        />

        {/* Resize gizmo — white corner handles (Babylon slate gizmo). Drag a
            corner outward with A to grow, inward to shrink. */}
        {([[1, 1], [-1, 1], [1, -1], [-1, -1]] as const).map(([fx, fy]) => (
          <CornerHandle
            key={`${fx}${fy}`}
            size={Math.min(width, height) * 0.09}
            position={[fx * (width / 2 + 0.035), fy * (height / 2 + 0.035), 0.001]}
            flipX={fx}
            flipY={fy}
            onDragDelta={(dx, dy, phase) => {
              if (phase === "start") {
                resizeStart.current = { pos: [0, 0, 0], scale: userScale };
                return;
              }
              setUserScale((sc) => Math.min(3, Math.max(0.4, sc + (dx + dy) * 1.2)));
            }}
          />
        ))}
      </ViroNode>
    </MovableNode>
  );
}
