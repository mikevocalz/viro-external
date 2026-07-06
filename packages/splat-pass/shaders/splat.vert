#version 310 es
precision highp float;

// Splat raster vertex stage — INSTANCED.
//
// Draw call: glDrawArraysIndirect(GL_TRIANGLE_STRIP) with args
//   {count=4, instanceCount=splatCount, first=0, baseInstance=0}.
//
// Each instance is one splat. Each invocation is one quad corner.
//   gl_VertexID  ∈ [0, 4)  → quad corner
//   gl_InstanceID ∈ [0, N) → splat index into decodedSplats[]
//
// Sort is intentionally absent here: premultiplied-alpha output blended
// with glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA) is APPROXIMATELY
// order-independent for small alphas, which is good enough for the
// validation/smoke path. A real bitonic sort comes back in M3.5.

struct Splat {
    vec4 position;
    vec4 scale;
    vec4 rotation;
    vec4 color;
};

layout(std430, binding = 0) readonly buffer DecodedSplats {
    Splat splats[];
};

uniform mat4 u_view;
uniform mat4 u_proj;

out vec4  v_color;
out vec2  v_uv;
out vec3  v_conic;

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
    uint quadVert = uint(gl_VertexID);
    uint sid = uint(gl_InstanceID);
    Splat s = splats[sid];

    v_color = s.color;

    vec4 viewPos4 = u_view * vec4(s.position.xyz, 1.0);
    vec3 viewPos  = viewPos4.xyz;

    // Cull behind-camera splats (OpenGL +z forward → in-view has z < 0).
    if (viewPos.z >= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        v_uv = vec2(0.0);
        v_conic = vec3(0.0);
        return;
    }

    mat3 R = quatToMat3(normalize(s.rotation));
    vec3 sxyz = exp(s.scale.xyz);
    mat3 S = mat3(
        sxyz.x, 0.0,    0.0,
        0.0,    sxyz.y, 0.0,
        0.0,    0.0,    sxyz.z
    );
    mat3 M = R * S;
    mat3 cov3D = M * transpose(M);

    mat3 J = projectionJacobian(viewPos, u_proj);
    mat3 W = mat3(u_view);
    mat3 T = J * W;
    mat3 cov2D3 = T * cov3D * transpose(T);
    mat2 cov2D = mat2(cov2D3[0].xy, cov2D3[1].xy);
    cov2D[0][0] += 0.0003;   // NDC-scale low-pass AA
    cov2D[1][1] += 0.0003;

    float det = cov2D[0][0] * cov2D[1][1] - cov2D[0][1] * cov2D[1][0];
    if (det <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        v_uv = vec2(0.0);
        v_conic = vec3(0.0);
        return;
    }
    float invDet = 1.0 / det;
    v_conic = vec3( cov2D[1][1] * invDet,
                   -cov2D[0][1] * invDet,
                    cov2D[0][0] * invDet);

    float mid = 0.5 * (cov2D[0][0] + cov2D[1][1]);
    float lambda = mid + sqrt(max(0.000001, mid * mid - det));
    float radius = ceil(3.0 * sqrt(lambda));

    vec4 clipCenter = u_proj * viewPos4;
    vec2 corner = vec2(((quadVert & 1u) != 0u) ? 1.0 : -1.0,
                       ((quadVert & 2u) != 0u) ? 1.0 : -1.0);
    vec2 ndcOffset = corner * radius;

    // Multiply by w so the post-divide quad ends up the right size.
    gl_Position = vec4(clipCenter.xy + ndcOffset * clipCenter.w,
                       clipCenter.zw);
    v_uv = ndcOffset;
}
