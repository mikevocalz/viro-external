import type { Vec3 } from "@viro-external/core";
import { isInsideRoundedPanel, panelCornerRadiiPx } from "./panel-coverage";

/**
 * A 4x4 affine matrix, column-major (`m[12..14]` is the translation), the
 * layout ViroCore's `VROMatrix4f` uses.
 */
export type Mat4 = readonly number[];

/** Node pose in Viro's prop conventions. @see {@linkcode composeNodeWorld} */
export interface NodePose {
  /** Metres. @default [0, 0, 0] */
  position?: Vec3;
  /** Degrees, applied X then Y then Z (`R = Rz·Ry·Rx`, ViroCore `VROQuaternion::set`). @default [0, 0, 0] */
  rotation?: Vec3;
  /** @default [1, 1, 1] */
  scale?: Vec3;
}

export const IDENTITY_MAT4: Mat4 = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** `a · b`, both column-major. */
export function multiplyMat4(a: Mat4, b: Mat4): number[] {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0);
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

/**
 * World matrix of a node: `parent · T · R · S`, the order ViroCore's
 * `VRONode::computeTransforms` builds a node's local transform in.
 */
export function composeNodeWorld(pose: NodePose, parent: Mat4 = IDENTITY_MAT4): number[] {
  const [px, py, pz] = pose.position ?? [0, 0, 0];
  const [rxDeg, ryDeg, rzDeg] = pose.rotation ?? [0, 0, 0];
  const [sx, sy, sz] = pose.scale ?? [1, 1, 1];
  const toRad = Math.PI / 180;
  const [cx, sxn] = [Math.cos(rxDeg * toRad), Math.sin(rxDeg * toRad)];
  const [cy, syn] = [Math.cos(ryDeg * toRad), Math.sin(ryDeg * toRad)];
  const [cz, szn] = [Math.cos(rzDeg * toRad), Math.sin(rzDeg * toRad)];
  // Rows of Rz·Ry·Rx.
  const r00 = cz * cy, r01 = cz * syn * sxn - szn * cx, r02 = cz * syn * cx + szn * sxn;
  const r10 = szn * cy, r11 = szn * syn * sxn + cz * cx, r12 = szn * syn * cx - cz * sxn;
  const r20 = -syn, r21 = cy * sxn, r22 = cy * cx;
  const local = [
    r00 * sx, r10 * sx, r20 * sx, 0,
    r01 * sy, r11 * sy, r21 * sy, 0,
    r02 * sz, r12 * sz, r22 * sz, 0,
    px, py, pz, 1,
  ];
  return multiplyMat4(parent, local);
}

/** Inverse of an affine matrix, or `undefined` when its linear part is singular. */
export function invertAffine(m: Mat4): number[] | undefined {
  const a = m[0] ?? 0, b = m[4] ?? 0, c = m[8] ?? 0;
  const d = m[1] ?? 0, e = m[5] ?? 0, g = m[9] ?? 0;
  const h = m[2] ?? 0, i = m[6] ?? 0, j = m[10] ?? 0;
  const det = a * (e * j - g * i) - b * (d * j - g * h) + c * (d * i - e * h);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return undefined;
  const inv = 1 / det;
  const i00 = (e * j - g * i) * inv, i01 = (c * i - b * j) * inv, i02 = (b * g - c * e) * inv;
  const i10 = (g * h - d * j) * inv, i11 = (a * j - c * h) * inv, i12 = (c * d - a * g) * inv;
  const i20 = (d * i - e * h) * inv, i21 = (b * h - a * i) * inv, i22 = (a * e - b * d) * inv;
  const tx = m[12] ?? 0, ty = m[13] ?? 0, tz = m[14] ?? 0;
  return [
    i00, i10, i20, 0,
    i01, i11, i21, 0,
    i02, i12, i22, 0,
    -(i00 * tx + i01 * ty + i02 * tz), -(i10 * tx + i11 * ty + i12 * tz), -(i20 * tx + i21 * ty + i22 * tz), 1,
  ];
}

export function transformPoint(m: Mat4, p: readonly number[]): Vec3 {
  const x = p[0] ?? 0, y = p[1] ?? 0, z = p[2] ?? 0;
  return [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
  ];
}

/**
 * The flat paper a pointer is mapped onto: a `ViroQuad` of `widthM x heightM`
 * centred on its node, facing +Z, showing a `widthPx x heightPx` texture of a
 * `boardWidth x boardHeight` board.
 *
 * Board units are QuickDraw view units, the space headless-board samples use
 * before the camera: zoom and pan are the board's camera, applied by the
 * board, so they never enter this mapping.
 */
export interface BoardSurfaceGeometry {
  widthM: number;
  heightM: number;
  /** Texture size in pixels. Corner hit testing runs in these pixels. */
  widthPx: number;
  heightPx: number;
  /** Board width in board units (1008 for MoyoLearn's 16:10 board). */
  boardWidth: number;
  boardHeight: number;
  /** Corner radius on the quad in metres, from `panel-tokens.md`. 0 is square. */
  cornerRadiusM: number;
  /**
   * How the board fills the quad when their aspects differ. `contain`
   * letterboxes and treats the margins as off the paper; `fill` stretches.
   * @default 'contain'
   */
  fit?: "contain" | "fill";
}

/** Result of {@linkcode mapWorldPointToBoard}. */
export type BoardHit =
  | { kind: "off-plane"; distanceM: number }
  | {
      kind: "on-plane";
      /** Quad-local position in metres, +Y up. */
      local: readonly [number, number];
      /** Position on the paper (letterbox removed), 0..1 from top-left. Not clamped. */
      paperUv: readonly [number, number];
      /** True when the point is on the visible paper: inside the content rect and not in a transparent corner. */
      isOnPaper: boolean;
    };

/**
 * Throws for a non-flat surface. ViroCore reports a hit as a world location
 * only (`VROHitTestResult` carries node, location and distance, no texture
 * coordinate), so a curved board's UV cannot be recovered from an event, and
 * this mapping refuses rather than flattening it.
 */
export function assertFlatBoard(curvature: number | undefined): void {
  if (curvature !== undefined && curvature !== 0) {
    throw new RangeError(
      `board input supports flat boards only, got curvature ${curvature}: Viro hit events carry a world ` +
        "location without a texture coordinate, so curved UV cannot be recovered",
    );
  }
}

/** Validates geometry once, where it enters the input path. */
export function assertValidGeometry(g: BoardSurfaceGeometry): void {
  for (const key of ["widthM", "heightM", "widthPx", "heightPx", "boardWidth", "boardHeight"] as const) {
    if (!Number.isFinite(g[key]) || g[key] <= 0) throw new RangeError(`${key} must be finite and > 0, got ${g[key]}`);
  }
  if (!Number.isFinite(g.cornerRadiusM) || g.cornerRadiusM < 0) {
    throw new RangeError(`cornerRadiusM must be finite and >= 0, got ${g.cornerRadiusM}`);
  }
}

/** The paper's rect inside the quad, in quad UV (0..1 from top-left). */
export function paperRectInQuad(g: BoardSurfaceGeometry): { u0: number; v0: number; du: number; dv: number } {
  if (g.fit === "fill") return { u0: 0, v0: 0, du: 1, dv: 1 };
  const quadAspect = g.widthM / g.heightM;
  const boardAspect = g.boardWidth / g.boardHeight;
  if (Math.abs(quadAspect - boardAspect) < 1e-9) return { u0: 0, v0: 0, du: 1, dv: 1 };
  if (boardAspect > quadAspect) {
    const dv = quadAspect / boardAspect;
    return { u0: 0, v0: (1 - dv) / 2, du: 1, dv };
  }
  const du = boardAspect / quadAspect;
  return { u0: (1 - du) / 2, v0: 0, du, dv: 1 };
}

/**
 * Maps a world point (a Viro hit location) onto the board.
 *
 * world → quad-local through the inverse world matrix (any translation,
 * rotation and non-uniform scale), then local → quad UV with the one Y flip
 * of this path (`v = 0.5 - y / heightM`: the quad is +Y up, the board is +Y
 * down), then quad UV → paper UV by removing the letterbox.
 *
 * @param planeToleranceM how far off the quad's plane, in world metres, a
 *   point may be and still count. Viro's high-accuracy hit is on the triangle,
 *   so only float noise is expected.
 */
export function mapWorldPointToBoard(
  worldPoint: readonly number[],
  boardWorld: Mat4,
  g: BoardSurfaceGeometry,
  planeToleranceM = 0.01,
): BoardHit | undefined {
  const inv = invertAffine(boardWorld);
  if (inv === undefined) return undefined;
  const [x, y, z] = transformPoint(inv, worldPoint);
  const zAxisLength = Math.hypot(boardWorld[8] ?? 0, boardWorld[9] ?? 0, boardWorld[10] ?? 0);
  const distanceM = Math.abs(z * zAxisLength);
  if (!(distanceM <= planeToleranceM)) return { kind: "off-plane", distanceM };
  const qu = x / g.widthM + 0.5;
  const qv = 0.5 - y / g.heightM;
  const rect = paperRectInQuad(g);
  const paperUv: [number, number] = [(qu - rect.u0) / rect.du, (qv - rect.v0) / rect.dv];
  const inContent = paperUv[0] >= 0 && paperUv[0] <= 1 && paperUv[1] >= 0 && paperUv[1] <= 1;
  const radii = panelCornerRadiiPx(g.cornerRadiusM, g.widthM, g.heightM, g.widthPx, g.heightPx);
  const isOnPaper = inContent && isInsideRoundedPanel(qu * g.widthPx, qv * g.heightPx, g.widthPx, g.heightPx, radii);
  return { kind: "on-plane", local: [x, y], paperUv, isOnPaper };
}

/** Paper UV to board units. */
export function paperUvToBoard(uv: readonly [number, number], g: Pick<BoardSurfaceGeometry, "boardWidth" | "boardHeight">): {
  x: number;
  y: number;
} {
  return { x: uv[0] * g.boardWidth, y: uv[1] * g.boardHeight };
}

/** QuickDraw's camera applied to a board-unit point: `page = view / z - (x, y)`. */
export function boardToPage(point: { x: number; y: number }, camera: { x: number; y: number; z: number }): {
  x: number;
  y: number;
} {
  return { x: point.x / camera.z - camera.x, y: point.y / camera.z - camera.y };
}

/**
 * The world point under the ray for a Viro `onDrag` report on a quad with
 * `dragType="FixedToPlane"` on its own plane and `dragTransform="none"`.
 *
 * ViroCore reports `nodeOrigin + (planeHit - planeHitAtDragStart)`
 * (`VROInputControllerBase::getDragPositionFixedToPlane`), so the live hit is
 * `dragToPos - nodeOrigin + pressHit`. `planeHitAtDragStart` is taken on the
 * first drag frame, not at the press; the result is offset by however far the
 * ray moved between the press and that frame (one frame of hand motion).
 */
export function planeHitFromDrag(dragToPos: readonly number[], nodeOriginAtPress: Vec3, pressHit: Vec3): Vec3 {
  return [
    (dragToPos[0] ?? 0) - nodeOriginAtPress[0] + pressHit[0],
    (dragToPos[1] ?? 0) - nodeOriginAtPress[1] + pressHit[1],
    (dragToPos[2] ?? 0) - nodeOriginAtPress[2] + pressHit[2],
  ];
}

/** The quad's plane in world space, for Viro's `dragPlane` prop. */
export function boardDragPlane(boardWorld: Mat4): { planePoint: Vec3; planeNormal: Vec3; maxDistance: number } {
  const o = transformPoint(boardWorld, [0, 0, 0]);
  const a = transformPoint(boardWorld, [1, 0, 0]).map((v, i) => v - (o[i] ?? 0));
  const b = transformPoint(boardWorld, [0, 1, 0]).map((v, i) => v - (o[i] ?? 0));
  const n: Vec3 = [
    (a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0),
    (a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0),
    (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0),
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return { planePoint: o, planeNormal: [n[0] / len, n[1] / len, n[2] / len], maxDistance: 10 };
}
