import React, { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import {
  resolveQuickDrawSurfaceIdentity,
  type NativeQuickDrawSpatialAdapter,
  type QuickDrawPointerEvent,
  type QuickDrawSpatialSurfaceConfig,
} from "@viro-external/xr-contract";
import { MovableNode } from "@viro-external/core";
import type { MovableProps, Vec3 } from "@viro-external/core";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";
import type { BoardSurfaceGeometry, Mat4 } from "./quickdraw-input/board-geometry";
import type { BoardInputRouter } from "./quickdraw-input/BoardInputRouter";
import { createBoardInputRouter } from "./quickdraw-input/createBoardInputRouter";
import { createAdapterHandleSink } from "./quickdraw-input/pointer-sinks";
import { useBoardPaperInput } from "./quickdraw-input/useBoardPaperInput";
import { useMovableBoardPose } from "./quickdraw-input/useMovableBoardPose";

export type QuickDrawSpatialSurfaceProps = MovableProps & {
  adapter: NativeQuickDrawSpatialAdapter;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  position?: Vec3;
  /** Degrees, Viro order. */
  rotation?: Vec3;
  scale?: Vec3;
  /** World matrix of the node this surface is mounted under. @default identity */
  parentWorld?: Mat4;
  /** Corner radius in metres, for hit testing. @default 0 */
  cornerRadiusM?: number;
  /**
   * When `interactive`, the board moves by a grip below it, never by
   * dragging the paper. @default PremiumMaterials.rail
   */
  gripMaterial?: string;
  interactive?: boolean;
  /** Change on tracking loss, focus loss or owner change to cancel in-flight strokes. */
  inputResetKey?: unknown;
  /** Receives every pointer event the surface dispatches to the adapter. */
  onPointer?: (event: QuickDrawPointerEvent) => void;
  children?: React.ReactNode;
};

const GRIP_HEIGHT_M = 0.09;
const GRIP_GAP_M = 0.03;

type MaterialState = { materialName: string };
const PLACEHOLDER = "quickdraw_spatial_placeholder";

/**
 * Shows an adapter's board on a `ViroQuad` and dispatches scene input to it.
 *
 * The adapter's identity is resolved at mount and a contradictory
 * declaration throws (see `resolveQuickDrawSurfaceIdentity`). When
 * `interactive`, rays on the paper go through a `BoardInputRouter` to
 * `handle.dispatchPointerEvent` (or the deprecated `dispatchPointer`), and
 * the board moves only by its grip.
 */
export function QuickDrawSpatialSurface({
  adapter,
  width,
  height,
  pageWidth,
  pageHeight,
  position,
  rotation,
  scale,
  parentWorld,
  cornerRadiusM = 0,
  gripMaterial,
  movable = true,
  dragType,
  dragPlane,
  onMoveStart,
  onMove,
  onMoveEnd,
  interactive = true,
  inputResetKey,
  onPointer,
  children,
}: QuickDrawSpatialSurfaceProps): React.ReactElement {
  resolveQuickDrawSurfaceIdentity(adapter);

  const routerRef = useRef<BoardInputRouter | undefined>(undefined);
  if (routerRef.current === undefined) routerRef.current = createBoardInputRouter();
  // Not disposed on unmount: it holds no native resource, and React may
  // re-run effects on the same instance. Unmount cancels and disables it.
  const router = routerRef.current;

  const storeRef = useRef<StoreApi<MaterialState> | undefined>(undefined);
  if (storeRef.current === undefined) {
    storeRef.current = createStore<MaterialState>(() => ({ materialName: PLACEHOLDER }));
  }
  const materialStore = storeRef.current;
  const materialName = useStore(materialStore, (s) => s.materialName);

  const config = useMemo<QuickDrawSpatialSurfaceConfig>(
    () => ({ width, height, pageWidth, pageHeight, interactive, drag: { enabled: movable } }),
    [height, interactive, movable, pageHeight, pageWidth, width],
  );

  const onPointerRef = useRef(onPointer);
  onPointerRef.current = onPointer;

  useEffect(() => {
    const handle = adapter.mount(config);
    materialStore.setState({ materialName: handle.materialName });
    const toHandle = createAdapterHandleSink(handle);
    const subscription = router.addOnPointerEventListener((event) => {
      toHandle(event);
      onPointerRef.current?.(event);
    });
    let isReleased = false;
    return () => {
      // Stop input before the handle goes away, and release it once.
      router.cancelAll("unmount");
      subscription.remove();
      if (isReleased) return;
      isReleased = true;
      handle.dispose();
      adapter.unmount(handle);
      materialStore.setState({ materialName: PLACEHOLDER });
    };
  }, [adapter, config, router, materialStore]);

  const pose = useMovableBoardPose({
    router,
    position,
    rotation,
    scale,
    parentWorld,
    onMoveStart,
    onMoveEnd,
  });

  const geometry = useMemo<BoardSurfaceGeometry>(
    () => ({
      widthM: width,
      heightM: height,
      widthPx: pageWidth,
      heightPx: pageHeight,
      boardWidth: pageWidth,
      boardHeight: pageHeight,
      cornerRadiusM,
    }),
    [width, height, pageWidth, pageHeight, cornerRadiusM],
  );
  const paperInput = useBoardPaperInput(router, {
    geometry,
    boardWorld: pose.boardWorld,
    isEnabled: interactive,
    resetKey: inputResetKey,
  });

  const showGrip = interactive && movable;
  const grip = gripMaterial ?? PremiumMaterials.rail;
  if (showGrip && gripMaterial === undefined) registerPremiumMaterials();

  return (
    <MovableNode
      movable={movable}
      dragType={dragType}
      dragPlane={dragPlane}
      position={pose.position}
      onMoveStart={pose.onMoveStart}
      onMove={onMove}
      onMoveEnd={pose.onMoveEnd}
    >
      <ViroNode rotation={rotation} scale={scale}>
        {interactive ? (
          <ViroQuad width={width} height={height} materials={[materialName]} {...paperInput}>
            {children}
          </ViroQuad>
        ) : (
          <ViroQuad width={width} height={height} materials={[materialName]}>
            {children}
          </ViroQuad>
        )}
        {showGrip ? (
          <ViroQuad
            width={width * 0.54}
            height={GRIP_HEIGHT_M}
            position={[0, -(height / 2 + GRIP_GAP_M + GRIP_HEIGHT_M / 2), 0]}
            materials={[grip]}
          />
        ) : null}
      </ViroNode>
    </MovableNode>
  );
}
