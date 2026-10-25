import React, { useMemo, useRef } from "react";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import { MovableNode } from "@viro-external/core";
import { PremiumMaterials, registerPremiumMaterials } from "../materials";
import type { BoardSurfaceGeometry, Mat4 } from "./board-geometry";
import type { QuickDrawBoardSession } from "./QuickDrawBoardSession";
import type { QuickDrawBoardSurface, QuickDrawNativeBoardProps, UseBoardRenderer } from "./QuickDrawNativeBoard.types";
import { useBoardPaperInput } from "./useBoardPaperInput";
import { useMovableBoardPose } from "./useMovableBoardPose";

const GRIP_HEIGHT_M = 0.09;
const GRIP_WIDTH_RATIO = 0.54;
const GRIP_GAP_M = 0.03;

/**
 * The QuickDraw board as Viro scene content: the session's headless board
 * edits the Store, the native renderer draws it into a `canvasSource`
 * material, and Viro rays and the Muse pen reach the board through the
 * session's input router.
 *
 * With `nativeBoard` off (the default) or when the renderer is unavailable or
 * fails, `fallback` (the WebView board) renders instead. The Store and its
 * history live in the session, so remounting, resizing or replacing the
 * surface never loses the document.
 *
 * The paper quad uses `dragTransform="none"`, so drawing never moves the
 * board; a separate grip below the paper does, and a grip drag cancels every
 * stroke first.
 */
export function QuickDrawNativeBoard(props: QuickDrawNativeBoardProps): React.ReactElement {
  const { nativeBoard = false, fallback, useRenderer, surface } = props;
  if (!nativeBoard) return <>{fallback}</>;
  if (useRenderer === undefined || surface === undefined) {
    throw new TypeError("QuickDrawNativeBoard: nativeBoard needs both useRenderer and surface");
  }
  return <NativeBoardBody {...props} useRenderer={useRenderer} surface={surface} />;
}

type BodyProps = QuickDrawNativeBoardProps & { useRenderer: UseBoardRenderer; surface: QuickDrawBoardSurface };

function NativeBoardBody(props: BodyProps): React.ReactElement {
  const {
    session,
    fallback,
    useRenderer,
    surface,
    widthM = 1.2,
    heightM = 0.75,
    cornerRadiusM = 0,
    backgroundColor = "#FFFFFF",
    interactive = true,
  } = props;
  assertLiveSession(session);
  const onErrorRef = useRef(props.onRendererError);
  onErrorRef.current = props.onRendererError;

  const status = useRenderer({
    store: session.store,
    board: session.board,
    surfaceId: surface.surfaceId,
    widthPx: surface.widthPx,
    heightPx: surface.heightPx,
    pixelRatio: surface.widthPx / session.boardWidth,
    // Corners come from the shared coverage function at the consumer (ADR 0001, corner ownership).
    cornerRadiusPx: 0,
    backgroundColor,
    onError: (error) => onErrorRef.current?.(error),
  });

  if (status.kind === "unavailable" || status.kind === "failed") return <>{fallback}</>;
  return (
    <BoardScene
      {...props}
      surface={surface}
      widthM={widthM}
      heightM={heightM}
      cornerRadiusM={cornerRadiusM}
      interactive={interactive && status.kind === "ready"}
    />
  );
}

type SceneProps = BodyProps & { widthM: number; heightM: number; cornerRadiusM: number; interactive: boolean };

function BoardScene(props: SceneProps): React.ReactElement {
  const { session, surface, widthM, heightM, cornerRadiusM, interactive, movable = true } = props;
  const gripMaterial = props.gripMaterial ?? PremiumMaterials.rail;
  if (props.gripMaterial === undefined) registerPremiumMaterials();
  const pose = useMovableBoardPose({
    router: session.input,
    position: props.position,
    rotation: props.rotation,
    scale: props.scale,
    parentWorld: props.parentWorld,
    onMoveStart: props.onMoveStart,
    onMoveEnd: props.onMoveEnd,
  });
  const geometry = useMemo<BoardSurfaceGeometry>(
    () => ({
      widthM,
      heightM,
      widthPx: surface.widthPx,
      heightPx: surface.heightPx,
      boardWidth: session.boardWidth,
      boardHeight: session.boardHeight,
      cornerRadiusM,
    }),
    [widthM, heightM, surface.widthPx, surface.heightPx, session.boardWidth, session.boardHeight, cornerRadiusM],
  );
  const paperInput = useBoardPaperInput(session.input, {
    geometry,
    boardWorld: pose.boardWorld as Mat4,
    isEnabled: interactive,
    resetKey: props.inputResetKey,
  });

  const showGrip = movable;
  return (
    <MovableNode
      movable={showGrip}
      position={pose.position}
      onMoveStart={pose.onMoveStart}
      onMoveEnd={pose.onMoveEnd}
    >
      <ViroNode rotation={props.rotation} scale={props.scale}>
        <ViroQuad width={widthM} height={heightM} materials={[surface.materialName]} {...paperInput} />
        {showGrip ? (
          <ViroQuad
            width={widthM * GRIP_WIDTH_RATIO}
            height={GRIP_HEIGHT_M}
            position={[0, -(heightM / 2 + GRIP_GAP_M + GRIP_HEIGHT_M / 2), 0]}
            materials={[gripMaterial]}
          />
        ) : null}
      </ViroNode>
    </MovableNode>
  );
}

function assertLiveSession(session: QuickDrawBoardSession): void {
  if (session.isDisposed) throw new Error(`QuickDrawNativeBoard: session ${session.id} is disposed`);
}
