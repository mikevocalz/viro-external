/**
 * TypeScript port of virocore's shared rounded-rect coverage function
 * (`ViroRenderer/VROPanelCoverage.h`, branch feat/panel-corners-compositor).
 * Every step rounds to binary32 with `Math.fround`, as the header's
 * `VROPanelCoverageShim` does, so a hit test here agrees with the pixels the
 * resolve copy and the finish pass draw.
 *
 * Coordinates are pixels with the panel spanning `[0, width] x [0, height]`.
 */

const f = Math.fround;

const clamp = (x: number, lo: number, hi: number): number => {
  // GLSL clamp = min(max(x, lo), hi), evaluated in binary32.
  const low = x < lo ? lo : x;
  return f(hi < low ? hi : low);
};

/**
 * Coverage in `[0, 1]` of the rounded rect `[0, width] x [0, height]` at
 * `(x, y)`, with per-axis corner radii in pixels. A one-pixel feather is
 * centred on the geometric edge: 0.5 on the edge, 1 at every pixel centre of
 * a straight edge, 1 everywhere when the radius is 0.
 */
export function panelCoverage(
  x: number,
  y: number,
  width: number,
  height: number,
  radiusX: number,
  radiusY: number,
): number {
  const halfX = f(f(width) * 0.5);
  const halfY = f(f(height) * 0.5);
  const rx = clamp(f(radiusX), 0, halfX);
  const ry = clamp(f(radiusY), 0, halfY);
  const qx = f(f(Math.abs(f(f(x) - halfX))) - f(halfX - rx));
  const qy = f(f(Math.abs(f(f(y) - halfY))) - f(halfY - ry));
  const sdEdge = Math.max(f(qx - rx), f(qy - ry));
  const safeRx = Math.max(rx, f(1.0e-6));
  const safeRy = Math.max(ry, f(1.0e-6));
  const nx = f(qx / safeRx);
  const ny = f(qy / safeRy);
  const len = f(Math.sqrt(f(f(nx * nx) + f(ny * ny))));
  const gx = f(nx / safeRx);
  const gy = f(ny / safeRy);
  const gradLen = f(Math.sqrt(f(f(gx * gx) + f(gy * gy))));
  const sdCorner = f(f(f(len - 1.0) * len) / Math.max(gradLen, f(1.0e-12)));
  const isCorner = qx > 0 && qy > 0 && rx > 0 && ry > 0;
  const sd = isCorner ? sdCorner : sdEdge;
  return clamp(f(0.5 - sd), 0, 1);
}

/** Per-axis corner radii in pixels. @see {@linkcode panelCornerRadiiPx} */
export interface PanelCornerRadiiPx {
  x: number;
  y: number;
}

/**
 * Pixel radii for a corner radius in metres, as `VROPanelCornerRadiiPx`:
 * the radius is clamped to half the panel's shorter side in metres first, so
 * the corner stays circular on the panel. Non-finite or non-positive input
 * gives `{ x: 0, y: 0 }`.
 */
export function panelCornerRadiiPx(
  radiusM: number,
  widthM: number,
  heightM: number,
  widthPx: number,
  heightPx: number,
): PanelCornerRadiiPx {
  const values = [radiusM, widthM, heightM, widthPx, heightPx];
  if (!values.every((v) => Number.isFinite(v) && v > 0)) return { x: 0, y: 0 };
  const shortSideM = f(widthM < heightM ? widthM : heightM);
  const half = f(0.5 * shortSideM);
  const r = f(radiusM) < half ? f(radiusM) : half;
  return { x: f(f(r * f(widthPx)) / f(widthM)), y: f(f(r * f(heightPx)) / f(heightM)) };
}

/**
 * Whether a point lands on the visible panel: inside the rect and at or
 * inward of the rounded edge (coverage >= 0.5), the rule virocore's
 * `VRORiveRoundedRectContains` applies to Rive pointer hits.
 */
export function isInsideRoundedPanel(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: PanelCornerRadiiPx,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width || y > height) return false;
  return panelCoverage(x, y, width, height, radii.x, radii.y) >= 0.5;
}
