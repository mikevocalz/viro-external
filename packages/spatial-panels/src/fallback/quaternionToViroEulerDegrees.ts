/**
 * Converts an xyzw quaternion to the Euler angles, in degrees, that Viro's
 * `rotation` prop expects. Port of VROQuaternion::toEuler (virocore
 * ViroRenderer/VROQuaternion.cpp), the inverse of the conversion Viro applies
 * to `rotation` (VROQuaternion::set(x, y, z)), so a node gets the same
 * orientation as the compositor layer.
 */
export function quaternionToViroEulerDegrees(
  q: readonly [number, number, number, number],
): [number, number, number] {
  const length = Math.hypot(q[0], q[1], q[2], q[3]);
  const x = q[0] / length;
  const y = q[1] / length;
  const z = q[2] / length;
  const w = q[3] / length;
  const test = 2 * (y * w - x * z);
  let ex: number;
  let ey: number;
  let ez: number;
  if (Math.abs(test - 1) <= 1e-6) {
    ez = -2 * Math.atan2(x, w);
    ex = 0;
    ey = Math.PI / 2;
  } else if (Math.abs(test + 1) <= 1e-6) {
    ez = 2 * Math.atan2(x, w);
    ex = 0;
    ey = -Math.PI / 2;
  } else {
    const sqx = x * x;
    const sqy = y * y;
    const sqz = z * z;
    const sqw = w * w;
    ez = Math.atan2(2 * (x * y + z * w), sqx - sqy - sqz + sqw);
    ex = Math.atan2(2 * (y * z + x * w), -sqx - sqy + sqz + sqw);
    ey = Math.asin(Math.min(1, Math.max(-1, test)));
  }
  const toDegrees = 180 / Math.PI;
  return [ex * toDegrees, ey * toDegrees, ez * toDegrees];
}
