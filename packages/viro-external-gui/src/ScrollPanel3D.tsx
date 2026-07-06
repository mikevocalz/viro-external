import React, { useMemo, useState } from "react";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { LucideIcon } from "./LucideIcon";

/**
 * Vertical scroll region for slate content. Viro has no stencil/clip masks,
 * so scrolling is windowed: only the rows inside the viewport render
 * (virtualized paging — Babylon's ScrollViewer semantics, discrete rows).
 * Right edge carries chevron-up / chevron-down buttons and a proportional
 * scrollbar thumb.
 */
export interface ScrollPanel3DProps {
  width: number;
  height: number;
  /** Row height in meters — children snap to rows. */
  itemHeight: number;
  position?: Vec3;
  children: React.ReactNode;
}

function Chevron(props: {
  dir: "chevron-up" | "chevron-down";
  size: number;
  position: Vec3;
  disabled: boolean;
  onClick: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  return (
    // Gizmo drag sink: without a local onDrag, an A-press walks up to the
    // slate's MovableNode and drags the whole slate. Gizmo = no movement.
    <ViroNode
      position={props.position}
      dragType={"Gizmo" as never}
      onDrag={() => {}}
    >
      <ViroQuad
        width={props.size}
        height={props.size}
        materials={[hovered && !props.disabled ? FluentMaterials.iconHover : FluentMaterials.iconIdle]}
        onHover={(h: boolean) => setHovered(h)}
        onClick={props.disabled ? undefined : props.onClick}
      />
      <LucideIcon
        name={props.dir}
        size={props.size * 0.7}
        position={[0, 0, 0.002]}
        opacity={props.disabled ? 0.3 : 1}
      />
    </ViroNode>
  );
}

export function ScrollPanel3D(props: ScrollPanel3DProps): React.ReactElement {
  const { width, height, itemHeight, position, children } = props;
  registerFluentMaterials();

  const items = useMemo(() => React.Children.toArray(children), [children]);
  const visibleCount = Math.max(1, Math.floor(height / itemHeight));
  const maxOffset = Math.max(0, items.length - visibleCount);
  const [offset, setOffset] = useState(0);
  const dragAnchor = React.useRef<{ y: number; offset: number } | null>(null);

  const railW = Math.min(0.07, width * 0.1);
  const railX = width / 2 - railW / 2;
  const chevron = railW * 0.9;

  // Proportional thumb on the track between the chevrons.
  const trackH = height - 2 * chevron - 0.02;
  const thumbH = Math.max(0.03, trackH * (visibleCount / Math.max(items.length, 1)));
  const thumbTravel = trackH - thumbH;
  const thumbY = maxOffset === 0
    ? 0
    : trackH / 2 - thumbH / 2 - (offset / maxOffset) * thumbTravel;

  const window = items.slice(offset, offset + visibleCount);

  return (
    <ViroNode position={position}>
      {/* Rows — windowed, top-aligned. */}
      {window.map((child, i) => (
        <ViroNode
          key={offset + i}
          position={[-(railW + 0.01) / 2, height / 2 - itemHeight / 2 - i * itemHeight, 0]}
        >
          {child}
        </ViroNode>
      ))}

      {/* Scroll rail. */}
      <ViroNode position={[railX, 0, 0]}>
        <Chevron
          dir="chevron-up"
          size={chevron}
          position={[0, height / 2 - chevron / 2, 0]}
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
        />
        <Chevron
          dir="chevron-down"
          size={chevron}
          position={[0, -(height / 2 - chevron / 2), 0]}
          disabled={offset >= maxOffset}
          onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
        />
        {/* Track + draggable thumb (Gizmo drag: reported, not moved — the
            thumb position is derived from offset, so it tracks perfectly). */}
        <ViroNode
          dragType={"Gizmo" as never}
          onDrag={(pos: number[]) => {
            const y = (pos as [number, number, number])[1];
            if (dragAnchor.current === null) {
              dragAnchor.current = { y, offset };
              return;
            }
            const dy = y - dragAnchor.current.y;
            const steps = thumbTravel > 0 ? Math.round((-dy / thumbTravel) * maxOffset) : 0;
            const next = Math.min(maxOffset, Math.max(0, dragAnchor.current.offset + steps));
            if (next !== offset) setOffset(next);
          }}
          onClickState={(state: number) => {
            if (state === 2) dragAnchor.current = null;
          }}
        >
          <ViroQuad
            width={railW * 0.35}
            height={trackH}
            materials={[FluentMaterials.iconIdle]}
          />
        </ViroNode>
        <ViroNode
          position={[0, thumbY, 0.001]}
          dragType={"Gizmo" as never}
          onDrag={(pos: number[]) => {
            const y = (pos as [number, number, number])[1];
            if (dragAnchor.current === null) {
              dragAnchor.current = { y, offset };
              return;
            }
            const dy = y - dragAnchor.current.y;
            const steps = thumbTravel > 0 ? Math.round((-dy / thumbTravel) * maxOffset) : 0;
            const next = Math.min(maxOffset, Math.max(0, dragAnchor.current.offset + steps));
            if (next !== offset) setOffset(next);
          }}
          onClickState={(state: number) => {
            if (state === 2) dragAnchor.current = null;
          }}
        >
          <ViroQuad
            width={railW * 0.6}
            height={thumbH}
            materials={[FluentMaterials.borderHover]}
          />
        </ViroNode>
      </ViroNode>
    </ViroNode>
  );
}
