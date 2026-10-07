import type { PortableXRNode } from "@viro-external/xr-contract";
import { compileSpecsScene, type SpecsSceneSnapshot } from "./index.js";
import {
  compileSpecsPolyline,
  type SpecsVolumetricLinePlan,
} from "./navigation.js";

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

export interface ViroCompiledPolylineLike {
  id: string;
  parentId?: string;
  points: readonly Vec3[];
  position?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  widthMeters: number;
  materialId?: string;
}

export interface ViroCompiledSpecsBundleLike {
  version: 1;
  scene: {
    version: 1;
    nodes: PortableXRNode[];
  };
  polylines?: readonly ViroCompiledPolylineLike[];
  bindings?: readonly {
    nodeId: string;
    hover?: boolean;
    gaze?: boolean;
    select?: boolean;
    drag?: boolean;
  }[];
  diagnostics?: readonly string[];
}

export interface SpecsCompiledPolyline {
  id: string;
  parentId?: string;
  plan: SpecsVolumetricLinePlan;
}

export interface SpecsViroBundleCompilation {
  scene: SpecsSceneSnapshot;
  polylines: SpecsCompiledPolyline[];
  diagnostics: string[];
}

function multiply(a: Vec3, b: Vec3): Vec3 {
  return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function rotateByQuaternion(point: Vec3, quaternion: Quat): Vec3 {
  const [qx, qy, qz, qw] = quaternion;
  const [vx, vy, vz] = point;

  // q * v * q^-1, expanded to avoid allocations/matrix conventions.
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

function applyLocalTransform(
  point: Vec3,
  transform: {
    position?: Vec3;
    rotation?: Quat;
    scale?: Vec3;
  }
): Vec3 {
  const scaled = multiply(point, transform.scale ?? [1, 1, 1]);
  const rotated = transform.rotation
    ? rotateByQuaternion(scaled, transform.rotation)
    : scaled;
  return add(rotated, transform.position ?? [0, 0, 0]);
}

function scaleFactor(
  scale: Vec3 | undefined,
  diagnostics: string[],
  id: string
): number {
  if (!scale) return 1;
  const values = scale.map((value) => Math.abs(value)) as Vec3;
  const max = Math.max(...values);
  const min = Math.min(...values);

  if (Math.abs(max - min) > 1e-6) {
    diagnostics.push(
      `Polyline ${id} has non-uniform scale; SPECS VolumetricLine uses the largest axis for tube width.`
    );
  }

  return max;
}

function worldPolyline(
  polyline: ViroCompiledPolylineLike,
  nodes: Map<string, PortableXRNode>,
  diagnostics: string[]
): { points: Vec3[]; widthMeters: number } {
  let points = polyline.points.map((point) =>
    applyLocalTransform(point, polyline)
  );
  let widthScale = scaleFactor(polyline.scale, diagnostics, polyline.id);

  let parentId = polyline.parentId;
  const seen = new Set<string>();

  while (parentId) {
    if (seen.has(parentId)) {
      throw new Error(
        `Portable scene contains a parent cycle at ${parentId} for polyline ${polyline.id}.`
      );
    }
    seen.add(parentId);

    const parent = nodes.get(parentId);
    if (!parent) {
      diagnostics.push(
        `Polyline ${polyline.id} parent ${parentId} is missing; remaining points stay in the nearest resolved frame.`
      );
      break;
    }

    points = points.map((point) => applyLocalTransform(point, parent));
    widthScale *= scaleFactor(parent.scale, diagnostics, polyline.id);
    parentId = parent.parentId;
  }

  return {
    points,
    widthMeters: polyline.widthMeters * widthScale,
  };
}

/**
 * Consumes the JSON-safe bundle emitted by @reactvision/react-viro's
 * serializeViroSpecsCompilation()/compileViroSpecsJSX() surface.
 *
 * This adapter deliberately remains structural: viro-external does not import
 * the Viro package, so applications can version the public renderer and Lens
 * backend independently within the documented compatibility range.
 */
export function compileViroBundleForSpecs(
  bundle: ViroCompiledSpecsBundleLike
): SpecsViroBundleCompilation {
  if (bundle.version !== 1 || bundle.scene.version !== 1) {
    throw new Error("Unsupported Viro SPECS bundle version.");
  }

  const compiledScene = compileSpecsScene(bundle.scene.nodes);
  const fatal = compiledScene.diagnostics.filter(
    (diagnostic) => diagnostic.level === "error"
  );
  if (fatal.length > 0) {
    throw new Error(
      `Viro SPECS scene compile failed: ${fatal
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`
    );
  }

  const diagnostics = [
    ...(bundle.diagnostics ?? []),
    ...compiledScene.diagnostics.map(
      (diagnostic) =>
        `${diagnostic.level}: ${diagnostic.nodeId ?? "scene"}: ${diagnostic.message}`
    ),
  ];
  const nodes = new Map(
    compiledScene.scene.nodes.map((node) => [node.id, node] as const)
  );

  const polylines = (bundle.polylines ?? []).map((polyline) => {
    const world = worldPolyline(polyline, nodes, diagnostics);
    return {
      id: polyline.id,
      ...(polyline.parentId ? { parentId: polyline.parentId } : {}),
      plan: compileSpecsPolyline({
        points: world.points,
        widthMeters: world.widthMeters,
        ...(polyline.materialId
          ? { materialId: polyline.materialId }
          : {}),
      }),
    };
  });

  return {
    scene: compiledScene.scene,
    polylines,
    diagnostics,
  };
}
