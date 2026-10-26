import type React from "react";
import type { Store } from "@quickdrawjs/core";
import type { Vec3 } from "@viro-external/core";
import type { HeadlessBoard } from "../quickdraw-headless/HeadlessBoard";
import type { Mat4 } from "./board-geometry";
import type { QuickDrawBoardSession } from "./QuickDrawBoardSession";

/**
 * The Viro `canvasSource` material the native renderer draws into. The host
 * allocates it (nitro-canvas `createCanvasSurface` plus `canvasSource`, as
 * viro's `components/CanvasPanel/useCanvasPanel.ts` does) and keeps it alive
 * while the board shows.
 *
 * @see {@linkcode QuickDrawNativeBoardProps.surface}
 */
export interface QuickDrawBoardSurface {
  /** Id the `canvasSource` material was created with. */
  surfaceId: number;
  /** Viro material bound to that surface. */
  materialName: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Options a board renderer hook receives. Matches
 * `UseWhiteboardRendererOptions` in `@viro-external/native-panels`.
 */
export interface BoardRendererHookOptions {
  store: Store;
  board?: HeadlessBoard;
  surfaceId: number;
  widthPx: number;
  heightPx: number;
  pixelRatio: number;
  cornerRadiusPx: number;
  backgroundColor: string;
  onError?: (error: Error) => void;
}

/**
 * What a board renderer hook reports. `unavailable` and `failed` show the
 * fallback board.
 */
export type BoardRendererHookStatus =
  | { kind: "unavailable" }
  | { kind: "creating" }
  | { kind: "ready"; state: string }
  | { kind: "failed"; error: Error };

/**
 * A hook that creates a native board renderer and keeps it in step with the
 * store: pass `useWhiteboardRenderer` from `@viro-external/native-panels`.
 * Injected because native-panels depends on this package. Pass the same
 * function on every render.
 */
export type UseBoardRenderer = (options: BoardRendererHookOptions) => BoardRendererHookStatus;

/**
 * Props for `QuickDrawNativeBoard`.
 */
export interface QuickDrawNativeBoardProps {
  /** Document, editor and input. Created outside React; survives remounts. */
  session: QuickDrawBoardSession;
  /**
   * Draw the paper with the native renderer. Off by default until device
   * parity with the WebView board is shown; `fallback` renders while off.
   * @default false
   */
  nativeBoard?: boolean;
  /** The WebView board, shown while `nativeBoard` is off or the native renderer is unavailable or failed. */
  fallback: React.ReactNode;
  /** Required when `nativeBoard` is on. */
  useRenderer?: UseBoardRenderer;
  /** Required when `nativeBoard` is on. */
  surface?: QuickDrawBoardSurface;
  /** Paper width in metres. @default 1.2 */
  widthM?: number;
  /** Paper height in metres. @default 0.75 */
  heightM?: number;
  /** Corner radius in metres from `docs/design/system/panel-tokens.md`, used for hit testing. @default 0 */
  cornerRadiusM?: number;
  /** Paper colour, sRGB hex. @default '#FFFFFF' */
  backgroundColor?: string;
  position?: Vec3;
  /** Degrees, Viro order (X, then Y, then Z). */
  rotation?: Vec3;
  scale?: Vec3;
  /** World matrix of the node this board is mounted under. @default identity */
  parentWorld?: Mat4;
  /** Shows a grip below the paper that moves the board. Drawing never moves it. @default true */
  movable?: boolean;
  /** Grip material. @default PremiumMaterials.rail */
  gripMaterial?: string;
  /** `false` cancels strokes and drops input. @default true */
  interactive?: boolean;
  /** Change on tracking loss, focus loss or owner change to cancel in-flight strokes. */
  inputResetKey?: unknown;
  onMoveStart?: () => void;
  onMoveEnd?: (position: Vec3) => void;
  onRendererError?: (error: Error) => void;
}
