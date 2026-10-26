/** Vertex data for Viro's `ViroGeometry`. */
export interface ArcMesh {
  readonly vertices: [number, number, number][];
  readonly normals: [number, number, number][];
  readonly texcoords: [number, number][];
  readonly triangleIndices: [number, number, number][];
}

/**
 * The visible arc of an OpenXR cylinder layer as a mesh in the layer's local
 * frame: the circle is centred on the origin, the arc is centred on -Z, and
 * its arc length is `widthM`. Texture coordinates follow the layer: u from
 * left to right, v = 1 on the top edge, because the fallback texture stores
 * rows bottom-up like the swapchain image.
 */
export function cylinderArcMesh(widthM: number, heightM: number, radiusM: number, segments = 32): ArcMesh {
  const angle = widthM / radiusM;
  const vertices: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  const texcoords: [number, number][] = [];
  const triangleIndices: [number, number, number][] = [];
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const phi = (u - 0.5) * angle;
    const px = radiusM * Math.sin(phi);
    const pz = -radiusM * Math.cos(phi);
    // Normals face the centre, where the viewer is.
    const normal: [number, number, number] = [-Math.sin(phi), 0, Math.cos(phi)];
    vertices.push([px, heightM / 2, pz], [px, -heightM / 2, pz]);
    normals.push(normal, normal);
    texcoords.push([u, 1], [u, 0]);
  }
  for (let i = 0; i < segments; i += 1) {
    const top = 2 * i;
    // Counter-clockwise seen from the centre.
    triangleIndices.push([top, top + 1, top + 2], [top + 2, top + 1, top + 3]);
  }
  return { vertices, normals, texcoords, triangleIndices };
}
