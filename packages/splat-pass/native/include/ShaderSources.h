// ShaderSources.h — GLSL embedded as C++ raw string literals.
//
// Mirrors the four files in shaders/ verbatim. A later codegen step
// (CMake-driven xxd / file-embed) can replace this with auto-generated
// content; for now editing both the .glsl file and this header in sync
// is acceptable since the surface is small and reviewable.
//
// Compile-time workgroup-size overrides are applied by VROSplatRenderPass
// via simple string replace before compileShader() runs.
//
// Source of truth: shaders/splat.vert, shaders/splat.frag,
//                  shaders/splat_sort.comp, shaders/splat_decode.comp.

#pragma once

namespace viroexternal {
namespace splat {

inline constexpr const char *SPLAT_VERT_GLSL = R"GLSL(#version 310 es
precision highp float;

// Instanced draw: count=4, instanceCount=splatCount
//   gl_VertexID  ∈ [0, 4) → quad corner
//   gl_InstanceID ∈ [0, N) → splat index into decodedSplats[]

struct Splat {
    vec4 position;
    vec4 scale;
    vec4 rotation;
    vec4 color;
};

layout(std430, binding = 0) readonly buffer DecodedSplats {
    Splat splats[];
};

// CPU bucket-sort emits one uint per splat, back-to-front order.
// gl_InstanceID indexes into this array; the value is the splat id
// to read from DecodedSplats.
layout(std430, binding = 1) readonly buffer SortedIndices {
    uint sortedIndex[];
};

uniform mat4 u_view;
uniform mat4 u_proj;

out vec4 v_color;
out vec2 v_uv;
out vec3 v_conic;

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
    // sortedIndex maps from draw-order index (back-to-front) to splat id.
    uint splatId = sortedIndex[sid];
    Splat s = splats[splatId];

    v_color = s.color;

    vec4 viewPos4 = u_view * vec4(s.position.xyz, 1.0);
    vec3 viewPos  = viewPos4.xyz;

    // Cull behind-camera splats (OpenGL convention: in-view z < 0).
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
    cov2D[0][0] += 0.0003;
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
    float radius = 3.0 * sqrt(lambda);

    // SAFETY CAP: discard pathologically oversized splats so a broken
    // quat/scale decode can't pin the GPU through full-screen overdraw.
    // Real splats from a well-encoded SPZ are ~0.001..0.05 NDC; the
    // synthetic grid uses radii up to ~0.5 NDC. Keep the cap loose
    // until the decoder matches the on-disk encoding precisely.
    if (radius > 0.5) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        v_uv = vec2(0.0);
        v_conic = vec3(0.0);
        return;
    }

    vec4 clipCenter = u_proj * viewPos4;
    vec2 corner = vec2(((quadVert & 1u) != 0u) ? 1.0 : -1.0,
                       ((quadVert & 2u) != 0u) ? 1.0 : -1.0);
    vec2 ndcOffset = corner * radius;

    // Multiply offset by w so the post-perspective-divide size is right.
    gl_Position = vec4(clipCenter.xy + ndcOffset * clipCenter.w,
                       clipCenter.zw);
    v_uv = ndcOffset;
}
)GLSL";

inline constexpr const char *SPLAT_FRAG_GLSL = R"GLSL(#version 310 es
precision highp float;

in vec4 v_color;
in vec2 v_uv;
in vec3 v_conic;

layout(location = 0) out vec4 fragColor;

const float ALPHA_CUTOFF = 0.0039;

void main() {
    float a = v_conic.x;
    float b = v_conic.y;
    float c = v_conic.z;
    float m = a * v_uv.x * v_uv.x + 2.0 * b * v_uv.x * v_uv.y + c * v_uv.y * v_uv.y;
    if (m < 0.0) {
        discard;
    }
    float gauss = exp(-0.5 * m);
    float alpha = v_color.a * gauss;
    if (alpha < ALPHA_CUTOFF) {
        discard;
    }
    // Premultiplied alpha output to match the blend func (ONE,
    // ONE_MINUS_SRC_ALPHA). Source RGB must equal source_alpha * color;
    // outputting raw color * gauss without the alpha factor was the
    // cause of the over-bright "mud" appearance on layered splats.
    fragColor = vec4(v_color.rgb * alpha, alpha);
}
)GLSL";

inline constexpr const char *SPLAT_SORT_COMP_GLSL = R"GLSL(#version 310 es
precision highp float;

#ifndef SPLAT_SORT_LOCAL_SIZE
#define SPLAT_SORT_LOCAL_SIZE 64
#endif

layout(local_size_x = SPLAT_SORT_LOCAL_SIZE) in;

layout(std430, binding = 0) readonly buffer DepthKeys {
    uint depthKey[];
};

layout(std430, binding = 1) buffer SortedIndices {
    uint sortedIndex[];
};

uniform uint u_count;
uniform uint u_stageK;
uniform uint u_stageJ;

void main() {
    uint i = gl_GlobalInvocationID.x;
    if (i >= u_count) return;

    uint ixj = i ^ u_stageJ;
    if (ixj <= i) return;

    uint ai = sortedIndex[i];
    uint aj = sortedIndex[ixj];
    uint ki = depthKey[ai];
    uint kj = depthKey[aj];

    bool ascending = (i & u_stageK) == 0u;
    bool swap = ascending ? (ki < kj) : (ki > kj);
    if (swap) {
        sortedIndex[i]   = aj;
        sortedIndex[ixj] = ai;
    }
}
)GLSL";

inline constexpr const char *SPLAT_DECODE_COMP_GLSL = R"GLSL(#version 310 es
precision highp float;

#ifndef SPLAT_DECODE_LOCAL_SIZE
#define SPLAT_DECODE_LOCAL_SIZE 64
#endif

layout(local_size_x = SPLAT_DECODE_LOCAL_SIZE) in;

struct SrcSplat {
    uvec4 packed0;
    uvec4 packed1;
    uvec2 packed2;
};

struct DstSplat {
    vec4 position;
    vec4 scale;
    vec4 rotation;
    vec4 color;
};

layout(std430, binding = 0) readonly buffer BaseBlock {
    SrcSplat base[];
};

layout(std430, binding = 1) readonly buffer DeltaBlock {
    SrcSplat delta[];
};

layout(std430, binding = 2) writeonly buffer DecodedSplats {
    DstSplat decoded[];
};

uniform uint  u_count;
uniform float u_timeNorm;
uniform uint  u_has4D;

void readSrc(SrcSplat s, out vec3 pos, out vec3 scale, out vec4 rot, out vec4 col) {
    vec2 p0 = unpackHalf2x16(s.packed0.x);
    vec2 p1 = unpackHalf2x16(s.packed0.y);
    vec2 p2 = unpackHalf2x16(s.packed0.z);
    vec2 p3 = unpackHalf2x16(s.packed0.w);
    vec2 p4 = unpackHalf2x16(s.packed1.x);
    vec2 p5 = unpackHalf2x16(s.packed1.y);
    vec2 p6 = unpackHalf2x16(s.packed1.z);
    pos   = vec3(p0.x, p0.y, p1.x);
    scale = vec3(p1.y, p2.x, p2.y);
    rot   = vec4(p3.x, p3.y, p4.x, p4.y);
    col   = vec4(p5.x, p5.y, p6.x, p6.y);
}

void main() {
    uint i = gl_GlobalInvocationID.x;
    if (i >= u_count) return;

    vec3 posB, scaleB, posD, scaleD;
    vec4 rotB, colB, rotD, colD;
    readSrc(base[i], posB, scaleB, rotB, colB);

    if (u_has4D != 0u) {
        readSrc(delta[i], posD, scaleD, rotD, colD);
        posB   += posD   * u_timeNorm;
        scaleB += scaleD * u_timeNorm;
        rotB    = normalize(mix(rotB, rotB + rotD, u_timeNorm));
        colB   += colD   * u_timeNorm;
    }

    DstSplat d;
    d.position = vec4(posB, 0.0);
    d.scale    = vec4(scaleB, colB.a);
    d.rotation = rotB;
    d.color    = vec4(colB.rgb * colB.a, colB.a);
    decoded[i] = d;
}
)GLSL";

}  // namespace splat
}  // namespace viroexternal
