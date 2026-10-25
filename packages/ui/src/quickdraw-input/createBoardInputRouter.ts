import type { Vec3 } from "@viro-external/core";
import type { MusePenSample, QuickDrawPointerEvent, QuickDrawPointerSource } from "@viro-external/xr-contract";
import {
  assertValidGeometry,
  invertAffine,
  mapWorldPointToBoard,
  planeHitFromDrag,
  transformPoint,
  type BoardSurfaceGeometry,
  type Mat4,
} from "./board-geometry";
import type { BoardInputCancelReason, BoardInputRouter, BoardInputRouterOptions } from "./BoardInputRouter";

// Viro ClickState codes (components/Types/ViroEvents.ts). 3 (CLICKED) follows
// 2 and carries nothing new.
const CLICK_DOWN = 1;
const CLICK_UP = 2;
const EYE_GAZE_SOURCE = 12;

type PointerState = {
  readonly pointerId: number;
  readonly source: QuickDrawPointerSource;
  isCaptured: boolean;
  isHovering: boolean;
  lastUv: readonly [number, number];
  lastTimestampMs: number;
  /** World hit and board origin at the press: the anchors Viro offsets drag reports from. */
  pressHit?: Vec3;
  pressOrigin?: Vec3;
};

const defaultNow = (): number => performance.now();

const defaultClassify = (source: number): QuickDrawPointerSource | "ignore" =>
  source === EYE_GAZE_SOURCE ? "ignore" : "controller";

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Creates the {@linkcode BoardInputRouter}. Input is ignored until
 * {@linkcode BoardInputRouter.setSurface} supplies geometry and a world matrix.
 */
export function createBoardInputRouter(options: BoardInputRouterOptions = {}): BoardInputRouter {
  const now = options.now ?? defaultNow;
  const classify = options.classifyViroSource ?? defaultClassify;
  const planeToleranceM = options.planeToleranceM ?? 0.01;
  const penContactToleranceM = options.penContactToleranceM ?? 0.02;
  const penHoverDistanceM = options.penHoverDistanceM ?? 0.1;

  const listeners = new Set<(event: QuickDrawPointerEvent) => void>();
  const pointers = new Map<string, PointerState>();
  let nextPointerId = 1;
  let geometry: BoardSurfaceGeometry | undefined;
  let boardWorld: Mat4 | undefined;
  let isEnabled = true;
  let isMoving = false;
  let isDisposed = false;

  const isLive = () => !isDisposed && isEnabled && !isMoving && geometry !== undefined && boardWorld !== undefined;

  const pointerFor = (key: string, source: QuickDrawPointerSource): PointerState => {
    let state = pointers.get(key);
    if (state === undefined) {
      state = { pointerId: nextPointerId, source, isCaptured: false, isHovering: false, lastUv: [0.5, 0.5], lastTimestampMs: -Infinity };
      nextPointerId += 1;
      pointers.set(key, state);
    }
    return state;
  };

  const emit = (
    state: PointerState,
    phase: QuickDrawPointerEvent["phase"],
    uv: readonly [number, number],
    timestampMs: number,
    pressure?: number,
  ) => {
    // Monotonic per pointer even if two clocks feed it.
    const t = Math.max(timestampMs, state.lastTimestampMs);
    state.lastTimestampMs = t;
    state.lastUv = uv;
    const event: QuickDrawPointerEvent = { phase, pointerId: state.pointerId, source: state.source, uv, timestampMs: t };
    if (pressure !== undefined) event.pressure = pressure;
    for (const listener of [...listeners]) listener(event);
  };

  const cancelState = (state: PointerState, timestampMs: number) => {
    if (state.isCaptured) {
      state.isCaptured = false;
      state.pressHit = undefined;
      state.pressOrigin = undefined;
      emit(state, "cancel", state.lastUv, timestampMs);
    }
    if (state.isHovering) {
      state.isHovering = false;
      emit(state, "leave", state.lastUv, timestampMs);
    }
  };

  // Also ends a board move: an unmount, reset or new surface during a grip
  // means the grip's own end (endBoardMove) may never arrive. beginBoardMove
  // sets the flag again right after its own cancel.
  const cancelAll = (_reason: BoardInputCancelReason) => {
    isMoving = false;
    const t = now();
    for (const state of pointers.values()) cancelState(state, t);
  };

  const map = (world: readonly number[]) => {
    if (geometry === undefined || boardWorld === undefined) return undefined;
    return mapWorldPointToBoard(world, boardWorld, geometry, planeToleranceM);
  };

  const clampedUv = (uv: readonly [number, number]): readonly [number, number] => [clamp01(uv[0]), clamp01(uv[1])];

  const hasPoint = (p: readonly number[]) => p.length >= 3 && p.every((v) => Number.isFinite(v));

  const viroKey = (source: number) => `viro:${source}`;

  const router: BoardInputRouter = {
    get capturedCount() {
      let n = 0;
      for (const state of pointers.values()) if (state.isCaptured) n += 1;
      return n;
    },

    setSurface(nextGeometry, nextWorld) {
      assertValidGeometry(nextGeometry);
      if (invertAffine(nextWorld) === undefined) throw new RangeError("board world matrix is singular");
      const changed = geometry !== undefined || boardWorld !== undefined;
      if (changed) cancelAll("surface-changed");
      isMoving = false;
      geometry = nextGeometry;
      boardWorld = nextWorld;
    },

    setEnabled(next) {
      if (!next) cancelAll("disabled");
      isEnabled = next;
    },

    beginBoardMove() {
      cancelAll("board-moved");
      isMoving = true;
    },

    endBoardMove(nextWorld) {
      if (invertAffine(nextWorld) === undefined) throw new RangeError("board world matrix is singular");
      boardWorld = nextWorld;
      isMoving = false;
    },

    handleViroClickState(clickState, position, source) {
      if (!isLive()) return;
      const kind = classify(source);
      if (kind === "ignore") return;
      const state = pointerFor(viroKey(source), kind);
      const t = now();
      if (clickState === CLICK_DOWN) {
        // An empty position is a background hit or a click Viro re-routed by
        // its grace window: it is not on the paper.
        if (state.isCaptured || !hasPoint(position)) return;
        const hit = map(position);
        if (hit === undefined || hit.kind !== "on-plane" || !hit.isOnPaper) return;
        state.isCaptured = true;
        state.isHovering = false;
        state.pressHit = [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0];
        state.pressOrigin = transformPoint(boardWorld ?? [], [0, 0, 0]);
        emit(state, "down", clampedUv(hit.paperUv), t);
      } else if (clickState === CLICK_UP) {
        if (!state.isCaptured) return;
        // Viro sends ClickUp to the node that took ClickDown, with an empty
        // position when the ray has left it; the stroke ends where it was.
        let uv = state.lastUv;
        if (hasPoint(position)) {
          const hit = map(position);
          if (hit !== undefined && hit.kind === "on-plane") uv = clampedUv(hit.paperUv);
        }
        state.isCaptured = false;
        state.pressHit = undefined;
        state.pressOrigin = undefined;
        emit(state, "up", uv, t);
      }
    },

    handleViroDrag(dragToPos, source) {
      if (!isLive() || !hasPoint(dragToPos)) return;
      const state = pointers.get(viroKey(source));
      if (state === undefined || !state.isCaptured || state.pressHit === undefined || state.pressOrigin === undefined) return;
      const hit = map(planeHitFromDrag(dragToPos, state.pressOrigin, state.pressHit));
      // Off the plane means Viro had no plane intersection this frame: skip
      // the sample rather than end the stroke.
      if (hit === undefined || hit.kind !== "on-plane") return;
      emit(state, "move", clampedUv(hit.paperUv), now());
    },

    handleViroHover(isHovering, position, source) {
      if (!isLive()) return;
      const kind = classify(source);
      if (kind === "ignore") return;
      const state = pointerFor(viroKey(source), kind);
      if (state.isCaptured) return;
      const t = now();
      const hit = isHovering && hasPoint(position) ? map(position) : undefined;
      if (hit !== undefined && hit.kind === "on-plane" && hit.isOnPaper) {
        state.isHovering = true;
        emit(state, "hover", clampedUv(hit.paperUv), t);
      } else if (state.isHovering) {
        state.isHovering = false;
        emit(state, "leave", state.lastUv, t);
      }
    },

    handlePenSample(sample) {
      if (!isLive()) return;
      const state = pointerFor("pen:muse", "pen");
      const t = sample.timestampMs ?? now();
      if (sample.phase === "cancel" || !sample.tracked || sample.position === null) {
        cancelState(state, t);
        return;
      }
      const projected = penProjection(sample.position);
      const pressure = penPressure(sample);
      switch (sample.phase) {
        case "down": {
          if (state.isCaptured || projected === undefined || projected.distanceM > penContactToleranceM) return;
          if (!projected.isOnPaper) return;
          state.isCaptured = true;
          state.isHovering = false;
          emit(state, "down", clampedUv(projected.paperUv), t, pressure);
          return;
        }
        case "move": {
          // A pressed pen keeps its stroke while lifted off the plane; the
          // tip is projected along the board normal until the press ends.
          if (!state.isCaptured || projected === undefined) return;
          emit(state, "move", clampedUv(projected.paperUv), t, pressure);
          return;
        }
        case "up": {
          if (!state.isCaptured) return;
          state.isCaptured = false;
          emit(state, "up", projected === undefined ? state.lastUv : clampedUv(projected.paperUv), t, pressure);
          return;
        }
        case "hover": {
          if (state.isCaptured) return;
          if (projected !== undefined && projected.isOnPaper && projected.distanceM <= penHoverDistanceM) {
            state.isHovering = true;
            emit(state, "hover", clampedUv(projected.paperUv), t);
          } else if (state.isHovering) {
            state.isHovering = false;
            emit(state, "leave", state.lastUv, t);
          }
          return;
        }
      }
    },

    cancelViroSource(source) {
      const state = pointers.get(viroKey(source));
      if (state !== undefined) cancelState(state, now());
    },

    cancelPen() {
      const state = pointers.get("pen:muse");
      if (state !== undefined) cancelState(state, now());
    },

    cancelAll,

    addOnPointerEventListener(listener) {
      listeners.add(listener);
      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },

    dispose() {
      if (isDisposed) return;
      cancelAll("disposed");
      isDisposed = true;
      listeners.clear();
    },
  };

  /** Pen tip projected onto the board plane along the board normal. */
  function penProjection(position: readonly number[]) {
    if (geometry === undefined || boardWorld === undefined) return undefined;
    const inv = invertAffine(boardWorld);
    if (inv === undefined) return undefined;
    const local = transformPoint(inv, position);
    const zAxisLength = Math.hypot(boardWorld[8] ?? 0, boardWorld[9] ?? 0, boardWorld[10] ?? 0);
    const onPlane = transformPoint(boardWorld, [local[0], local[1], 0]);
    const hit = mapWorldPointToBoard(onPlane, boardWorld, geometry, Infinity);
    if (hit === undefined || hit.kind !== "on-plane") return undefined;
    return { paperUv: hit.paperUv, isOnPaper: hit.isOnPaper, distanceM: Math.abs(local[2] * zAxisLength) };
  }

  return router;
}

/** The stylus's own pressure when it is a valid reading; never a made-up value. */
function penPressure(sample: MusePenSample): number | undefined {
  const p = sample.pressure;
  return Number.isFinite(p) && p >= 0 && p <= 1 ? p : undefined;
}
