/**
 * Transform math for the Specs mapper, matching the fork's runtime compiler
 * (`components/Specs/ViroSpecsCompiler.ts`) so both paths place content the
 * same way. Positions in meters, rotations as Viro Euler degrees or [x,y,z,w]
 * quaternions.
 */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Transform = { position: Vec3; rotation: Quat; scale: Vec3 };

export const IDENTITY: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

/** Viro's XYZ Euler degrees as a quaternion. */
export function degreesToQuaternion(rotation?: readonly number[]): Quat | undefined {
  if (!rotation || rotation.length < 3) return undefined;
  const [x, y, z] = rotation.map((value) => (value * Math.PI) / 180) as Vec3;
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

export function multiplyQuat(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function rotatePoint(rotation: Quat, point: Vec3): Vec3 {
  const [qx, qy, qz, qw] = rotation;
  const [x, y, z] = point;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

/** A child's world transform from its parent's and its own Viro props. */
export function composeTransform(
  parent: Transform,
  props: { position?: readonly number[]; rotation?: readonly number[]; scale?: readonly number[] }
): Transform {
  const local = (props.position ?? [0, 0, 0]) as Vec3;
  const scale = (props.scale ?? [1, 1, 1]) as Vec3;
  const rotation = degreesToQuaternion(props.rotation) ?? [0, 0, 0, 1];
  const offset = rotatePoint(parent.rotation, [
    local[0] * parent.scale[0],
    local[1] * parent.scale[1],
    local[2] * parent.scale[2],
  ]);
  return {
    position: [
      parent.position[0] + offset[0],
      parent.position[1] + offset[1],
      parent.position[2] + offset[2],
    ],
    rotation: multiplyQuat(parent.rotation, rotation),
    scale: [parent.scale[0] * scale[0], parent.scale[1] * scale[1], parent.scale[2] * scale[2]],
  };
}

/** A point in a node's space, in world space. */
export function transformPoint(transform: Transform, point: Vec3): Vec3 {
  const rotated = rotatePoint(transform.rotation, [
    point[0] * transform.scale[0],
    point[1] * transform.scale[1],
    point[2] * transform.scale[2],
  ]);
  return [
    transform.position[0] + rotated[0],
    transform.position[1] + rotated[1],
    transform.position[2] + rotated[2],
  ];
}
