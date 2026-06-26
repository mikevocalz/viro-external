#version 310 es
precision highp float;

// Splat raster vertex stage.
//
// Reads decoded splats from SSBO 0 in sorted order via SSBO 1
// (sortedIndices[]). For each splat, projects to clip space, builds the
// 2D screen-space covariance from the 3D Gaussian, and emits a quad
// vertex covering the 3-sigma footprint. The fragment stage evaluates
// the Gaussian alpha at this vertex's screen position.
//
// Input layout:
//   binding 0: decodedSplats[]   (64 bytes / splat — see SplatBuffers.h)
//   binding 1: sortedIndices[]   (uint32 per splat, sorted back-to-front)
//
// Output to fragment:
//   v_color      — premultiplied RGBA
//   v_uv         — quad-local UV, [-3, +3] in 2D-Gaussian sigma space
//   v_conic      — inverse 2D covariance (a, b, c packed)
//

struct Splat {
    vec4 position;    // xyz = world position; w = pad
    vec4 scale;       // xyz = log-scale (per axis); w = alpha
    vec4 rotation;    // quaternion (x, y, z, w)
    vec4 color;       // premultiplied RGBA
};

layout(std430, binding = 0) readonly buffer DecodedSplats {
    Splat splats[];
};

layout(std430, binding = 1) readonly buffer SortedIndices {
    uint sortedIndex[];
};

uniform mat4 u_view;
uniform mat4 u_proj;

out vec4  v_color;
out vec2  v_uv;
out vec3  v_conic;
flat out uint v_splatId;

// Build the upper-3x3 of the rotation matrix from a unit quaternion.
mat3 quatToMat3(vec4 q) {
    float xx = q.x * q.x, yy = q.y * q.y, zz = q.z * q.z;
    float xy = q.x * q.y, xz = q.x * q.z, yz = q.y * q.z;
    float wx = q.w * q.x, wy = q.w * q.y, wz = q.w * q.z;
    return mat3(
        1.0 - 2.0 * (yy + zz), 2.0 * (xy + wz),       2.0 * (xz - wy),
        2.0 * (xy - wz),       1.0 - 2.0 * (xx + zz), 2.0 * (yz + wx),
        2.0 * (xz + wy),       2.0 * (yz - wx),       1.0 - 2.0 * (xx + yy)
    );
}

// 3D-to-2D Jacobian for perspective projection at the splat's view-space
// position. Reference: Zwicker et al. "EWA Splatting" (2002) eq. 28-29.
mat3 projectionJacobian(vec3 viewPos, mat4 proj) {
    float fx = proj[0][0];
    float fy = proj[1][1];
    float z = viewPos.z;
    float z2 = z * z;
    return mat3(
        fx / z, 0.0,    -fx * viewPos.x / z2,
        0.0,    fy / z, -fy * viewPos.y / z2,
        0.0,    0.0,    0.0
    );
}

void main() {
    uint quadVert = uint(gl_VertexID) & 3u;
    uint splatRank = uint(gl_VertexID) >> 2u;
    uint sid = sortedIndex[splatRank];
    Splat s = splats[sid];

    v_splatId = sid;
    v_color   = s.color;

    // World → eye
    vec4 viewPos4 = u_view * vec4(s.position.xyz, 1.0);
    vec3 viewPos  = viewPos4.xyz;

    // Build the 3D covariance: M = R * diag(scale^2) * R^T
    mat3 R = quatToMat3(normalize(s.rotation));
    vec3 sxyz = exp(s.scale.xyz);   // store log-scale, exp on use
    mat3 S = mat3(
        sxyz.x, 0.0,    0.0,
        0.0,    sxyz.y, 0.0,
        0.0,    0.0,    sxyz.z
    );
    mat3 M = R * S;
    mat3 cov3D = M * transpose(M);

    // 3D → 2D covariance via the projection Jacobian.
    mat3 J = projectionJacobian(viewPos, u_proj);
    mat3 W = mat3(u_view);
    mat3 T = J * W;
    mat3 cov2D3 = T * cov3D * transpose(T);
    mat2 cov2D = mat2(cov2D3[0].xy, cov2D3[1].xy);
    cov2D[0][0] += 0.3;  // low-pass anti-alias
    cov2D[1][1] += 0.3;

    // Inverse 2D covariance (conic) for the fragment stage.
    float det = cov2D[0][0] * cov2D[1][1] - cov2D[0][1] * cov2D[1][0];
    if (det <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // outside clip
        v_uv = vec2(0.0);
        v_conic = vec3(0.0);
        return;
    }
    float invDet = 1.0 / det;
    v_conic = vec3( cov2D[1][1] * invDet,
                   -cov2D[0][1] * invDet,
                    cov2D[0][0] * invDet);

    // 3-sigma screen-space footprint.
    float mid = 0.5 * (cov2D[0][0] + cov2D[1][1]);
    float lambda = mid + sqrt(max(0.1, mid * mid - det));
    float radius = ceil(3.0 * sqrt(lambda));

    // Emit one of four quad corners around the projected centre.
    vec4 clipCenter = u_proj * viewPos4;
    vec2 ndcCenter = clipCenter.xy / clipCenter.w;

    vec2 corner = vec2(((quadVert & 1u) != 0u) ? 1.0 : -1.0,
                       ((quadVert & 2u) != 0u) ? 1.0 : -1.0);
    vec2 pxOffset = corner * radius;

    // Viewport size assumed 1.0 in NDC; the actual viewport scale lands
    // through the projection matrix. The fragment shader receives pixel
    // offsets via v_uv and works in pixel space relative to the centre.
    gl_Position = clipCenter + vec4(pxOffset, 0.0, 0.0);
    v_uv = pxOffset;
}
