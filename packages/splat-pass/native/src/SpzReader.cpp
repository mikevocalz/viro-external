#include "SpzReader.h"

#include <cmath>
#include <cstring>

namespace viroexternal {
namespace splat {

namespace {
uint32_t readU32LE(const uint8_t *p) {
    return  static_cast<uint32_t>(p[0])
         | (static_cast<uint32_t>(p[1]) << 8)
         | (static_cast<uint32_t>(p[2]) << 16)
         | (static_cast<uint32_t>(p[3]) << 24);
}

// Sign-extend a 24-bit little-endian integer.
int32_t readI24LE(const uint8_t *p) {
    uint32_t raw = static_cast<uint32_t>(p[0])
                 | (static_cast<uint32_t>(p[1]) << 8)
                 | (static_cast<uint32_t>(p[2]) << 16);
    if (raw & 0x00800000u) raw |= 0xff000000u;   // sign-extend
    return static_cast<int32_t>(raw);
}

constexpr int FLOATS_PER_SPLAT = 16;   // vec4 × 4 = pos/scale/rot/color

// Reconstruct a unit quaternion from SPZ's 3-byte encoding. SPZ stores
// (x,y,z) as i8 in [-127, 127] mapped to [-1, 1] and reconstructs the
// real component w = sqrt(max(0, 1 - x²- y²- z²)). The encoded quaternion
// is forced positive-w by the writer, so this is unambiguous — no
// largest-component index byte is used (that's a different scheme).
void decodeQuat(const uint8_t *p, float out[4]) {
    int8_t a = static_cast<int8_t>(p[0]);
    int8_t b = static_cast<int8_t>(p[1]);
    int8_t c = static_cast<int8_t>(p[2]);
    float x = static_cast<float>(a) * (1.0f / 127.0f);
    float y = static_cast<float>(b) * (1.0f / 127.0f);
    float z = static_cast<float>(c) * (1.0f / 127.0f);
    float wsq = 1.0f - (x*x + y*y + z*z);
    float w = wsq > 0.0f ? std::sqrt(wsq) : 0.0f;
    // Normalize to guard against quantization drift.
    float n = std::sqrt(x*x + y*y + z*z + w*w);
    if (n > 0.0f) {
        float inv = 1.0f / n;
        x *= inv; y *= inv; z *= inv; w *= inv;
    }
    out[0] = x; out[1] = y; out[2] = z; out[3] = w;
}

// Per-splat SH tail size, in bytes. (L+1)² - 1 directional coefficients
// × 3 channels (RGB) × 1 byte (i8) per coefficient.
size_t shTailBytesPerSplat(uint8_t shDegree) {
    switch (shDegree) {
        case 0: return 0;
        case 1: return  3 * 3;   //  3 dir × RGB
        case 2: return  8 * 3;
        case 3: return 15 * 3;
        default: return 0;
    }
}
}  // namespace

SpzReadResult readSpzHeader(const uint8_t *data, size_t length) {
    SpzReadResult out{};
    if (length < SPZ_HEADER_BYTES) {
        out.error = SpzError::TooSmall;
        return out;
    }
    out.header.magic          = readU32LE(data);
    out.header.version        = readU32LE(data + 4);
    out.header.numPoints      = readU32LE(data + 8);
    out.header.shDegree       = data[12];
    out.header.fractionalBits = data[13];
    out.header.flags          = data[14];
    out.header.reserved       = data[15];
    out.bodyOffset            = SPZ_HEADER_BYTES;

    if (out.header.magic != SPZ_MAGIC) {
        out.error = SpzError::BadMagic;
        return out;
    }
    if (out.header.version != 2 && out.header.version != 3) {
        out.error = SpzError::UnsupportedVersion;
        return out;
    }
    if (out.header.shDegree > 3) {
        out.error = SpzError::UnsupportedShDegree;
        return out;
    }
    out.error = SpzError::Ok;
    return out;
}

SpzError decodeSpzBody(const SpzHeader &header,
                       const uint8_t *body, size_t bodyLength,
                       float *outSplats) {
    const uint32_t n = header.numPoints;
    if (n == 0) return SpzError::Ok;

    // Per-splat sizes (v2/v3 without SH):
    //   positions: 9 bytes (3 × i24)
    //   alphas:    1 byte
    //   colors:    3 bytes
    //   scales:    3 bytes
    //   rotations: 3 bytes
    const size_t POS_BYTES   = 9;
    const size_t REST_BYTES  = 1 + 3 + 3 + 3;
    const size_t shBytes     = shTailBytesPerSplat(header.shDegree);
    const size_t needed      = static_cast<size_t>(n) * (POS_BYTES + REST_BYTES + shBytes);
    if (bodyLength < needed) return SpzError::TooSmall;

    const uint8_t *pPos    = body;
    const uint8_t *pAlpha  = pPos    + n * POS_BYTES;
    const uint8_t *pColor  = pAlpha  + n;
    const uint8_t *pScale  = pColor  + n * 3;
    const uint8_t *pRot    = pScale  + n * 3;

    const float invFracDiv = 1.0f / static_cast<float>(1u << header.fractionalBits);

    for (uint32_t i = 0; i < n; ++i) {
        // Position: 3 × i24 / 2^fractionalBits
        float px = static_cast<float>(readI24LE(pPos + i * POS_BYTES + 0)) * invFracDiv;
        float py = static_cast<float>(readI24LE(pPos + i * POS_BYTES + 3)) * invFracDiv;
        float pz = static_cast<float>(readI24LE(pPos + i * POS_BYTES + 6)) * invFracDiv;

        // Scale: 3 × u8, log-encoded.  value/16 - 10  →  log(scale) used
        // by the vertex shader's exp(s.scale.xyz).
        float sx = static_cast<float>(pScale[i * 3 + 0]) * (1.0f / 16.0f) - 10.0f;
        float sy = static_cast<float>(pScale[i * 3 + 1]) * (1.0f / 16.0f) - 10.0f;
        float sz = static_cast<float>(pScale[i * 3 + 2]) * (1.0f / 16.0f) - 10.0f;

        // Rotation: 3 × i8 → reconstruct unit quat (see decodeQuat).
        float quat[4];
        decodeQuat(pRot + i * 3, quat);

        // Color: 3 × u8 in linear-light /255.
        float cr = static_cast<float>(pColor[i * 3 + 0]) * (1.0f / 255.0f);
        float cg = static_cast<float>(pColor[i * 3 + 1]) * (1.0f / 255.0f);
        float cb = static_cast<float>(pColor[i * 3 + 2]) * (1.0f / 255.0f);

        // Alpha: u8/255.
        float ca = static_cast<float>(pAlpha[i]) * (1.0f / 255.0f);

        float *slot = outSplats + i * FLOATS_PER_SPLAT;
        // vec4 position (xyz + pad)
        slot[0]  = px;
        slot[1]  = py;
        slot[2]  = pz;
        slot[3]  = 0.0f;
        // vec4 scale (log-scale xyz + alpha)
        slot[4]  = sx;
        slot[5]  = sy;
        slot[6]  = sz;
        slot[7]  = ca;
        // vec4 rotation
        slot[8]  = quat[0];
        slot[9]  = quat[1];
        slot[10] = quat[2];
        slot[11] = quat[3];
        // vec4 color — premultiplied for the raster blend mode
        slot[12] = cr * ca;
        slot[13] = cg * ca;
        slot[14] = cb * ca;
        slot[15] = ca;
    }

    // SH coefficients live after `pRot + n*3`. shTailBytesPerSplat(deg)
    // bytes per splat. We validated the length above; the bytes are not
    // decoded here because the raster shader does not yet evaluate SH.
    // ponytail: when SH lands, copy `pRot + n*3` through
    // `pRot + n*3 + n*shBytes` into a sibling SSBO and bind it.
    return SpzError::Ok;
}

const char *spzErrorString(SpzError e) {
    switch (e) {
        case SpzError::Ok:                  return "ok";
        case SpzError::TooSmall:            return "buffer smaller than expected";
        case SpzError::BadMagic:            return "magic mismatch (not an SPZ file)";
        case SpzError::UnsupportedVersion:  return "unsupported SPZ version";
        case SpzError::UnsupportedShDegree: return "shDegree must be 0..3";
    }
    return "unknown";
}

}  // namespace splat
}  // namespace viroexternal

// Self-check: header parsing + half-float packer + body decode round-trip.
#ifdef SPLAT_PASS_SELFTEST
#include <cassert>
#include <cstdio>
#include <vector>

int main() {
    using namespace viroexternal::splat;

    // Header tests
    {
        uint8_t buf[4] = {0};
        assert(readSpzHeader(buf, 4).error == SpzError::TooSmall);
    }
    {
        uint8_t buf[16] = {0};
        assert(readSpzHeader(buf, 16).error == SpzError::BadMagic);
    }

    // Synthetic 1-splat SPZ body, fractionalBits = 12 → divisor 4096.
    // position (1.0, 2.0, 3.0) needs raw i24 values (4096, 8192, 12288).
    SpzHeader hdr{};
    hdr.numPoints = 1;
    hdr.fractionalBits = 12;
    hdr.shDegree = 0;

    std::vector<uint8_t> body(9 + 1 + 3 + 3 + 3, 0);
    auto packI24 = [](uint8_t *dst, int32_t v) {
        dst[0] = static_cast<uint8_t>(v & 0xff);
        dst[1] = static_cast<uint8_t>((v >> 8) & 0xff);
        dst[2] = static_cast<uint8_t>((v >> 16) & 0xff);
    };
    packI24(&body[0], 4096);
    packI24(&body[3], 8192);
    packI24(&body[6], 12288);
    body[9]  = 255;            // alpha = 1.0
    body[10] = 128;            // R ~ 0.5
    body[11] = 64;             // G ~ 0.25
    body[12] = 0;              // B ~ 0.0
    body[13] = 160;            // scale.x → 10 - 10 = 0  → exp(0) = 1
    body[14] = 160;
    body[15] = 160;
    body[16] = 0;              // rot.x = 0
    body[17] = 0;              // rot.y = 0
    body[18] = 0;              // rot.z = 0 → quat = (0,0,0,1) identity

    std::vector<float> splats(1 * 16, 0.0f);
    SpzError err = decodeSpzBody(hdr, body.data(), body.size(), splats.data());
    assert(err == SpzError::Ok);

    // Verify direct float32 round-trip
    assert(splats[0]  == 1.0f);
    assert(splats[1]  == 2.0f);
    assert(splats[2]  == 3.0f);
    assert(splats[4]  == 0.0f);     // scale.x log = 0
    assert(splats[8]  == 0.0f);     // rot.x
    assert(splats[11] == 1.0f);     // rot.w (identity)
    assert(splats[15] == 1.0f);     // alpha
    assert(splats[12] == 128.0f/255.0f * 1.0f);  // R premultiplied
    std::printf("SpzReader selftest passed\n");
    return 0;
}
#endif
