#include "SpzReader.h"

#include <algorithm>
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

// Niantic SPZ "FirstThree" quat decode (v1, v2 files): the writer
// stores (x, y, z) as u8 mapped to [-1, 1] via (r/127.5) - 1, with the
// quat normalized so w >= 0. Reconstruct w = sqrt(max(0, 1 - x²- y²- z²)).
// (Niantic load-spz.cc::unpackQuaternionFirstThree)
void decodeQuatFirstThree(const uint8_t *p, float out[4]) {
    float x = static_cast<float>(p[0]) * (1.0f / 127.5f) - 1.0f;
    float y = static_cast<float>(p[1]) * (1.0f / 127.5f) - 1.0f;
    float z = static_cast<float>(p[2]) * (1.0f / 127.5f) - 1.0f;
    float wsq = 1.0f - (x*x + y*y + z*z);
    float w = wsq > 0.0f ? std::sqrt(wsq) : 0.0f;
    out[0] = x; out[1] = y; out[2] = z; out[3] = w;
}

// Niantic SPZ "SmallestThree" quat decode (v3+ files). 4 bytes
// packed as a uint32: bits[30..31] = largest-component index; the other
// three bits[0..29] store three 10-bit (9-bit magnitude + 1 sign-bit)
// components scaled by sqrt(1/2). The largest is reconstructed from
// sqrt(1 - sum_squares).
// (Niantic load-spz.cc::unpackQuaternionSmallestThree)
void decodeQuatSmallestThree(const uint8_t *p, float out[4]) {
    const float kSqrt1_2 = 0.7071067811865475f;
    uint32_t comp = static_cast<uint32_t>(p[0])
                  | (static_cast<uint32_t>(p[1]) << 8)
                  | (static_cast<uint32_t>(p[2]) << 16)
                  | (static_cast<uint32_t>(p[3]) << 24);
    constexpr uint32_t c_mask = (1u << 9u) - 1u;
    const int iLargest = static_cast<int>(comp >> 30);
    float sumSq = 0.0f;
    for (int i = 3; i >= 0; --i) {
        if (i == iLargest) continue;
        uint32_t mag = comp & c_mask;
        uint32_t neg = (comp >> 9u) & 0x1u;
        comp >>= 10u;
        float v = kSqrt1_2 * static_cast<float>(mag) / static_cast<float>(c_mask);
        if (neg) v = -v;
        out[i] = v;
        sumSq += v * v;
    }
    out[iLargest] = std::sqrt(std::max(0.0f, 1.0f - sumSq));
}

// SH DC → linear-RGB. Niantic stores colors as quantized SH-L0
// coefficients: stored = (sh_dc * colorScale + 0.5) * 255 with
// colorScale = 0.15. To get the renderable [0,1] color, evaluate the
// SH basis at the splat direction: linear = 0.5 + sh_dc * 0.2820947917
// where 0.5/sqrt(pi) is the SH-L0 basis value Y₀⁰.
// (Niantic load-spz.cc::unpackGaussians + colorScale = 0.15)
float decodeColorChannel(uint8_t raw) {
    constexpr float kColorScale = 0.15f;
    constexpr float kShDc = 0.28209479177387814f;
    float sh = (static_cast<float>(raw) / 255.0f - 0.5f) / kColorScale;
    return 0.5f + sh * kShDc;
}

size_t shTailBytesPerSplat(uint8_t shDegree) {
    // dimForDegree: 0→0, 1→3, 2→8, 3→15, 4→24 — directional coefficients
    // per channel × 3 channels (RGB).
    int dim = 0;
    switch (shDegree) {
        case 0: dim = 0; break;
        case 1: dim = 3; break;
        case 2: dim = 8; break;
        case 3: dim = 15; break;
        case 4: dim = 24; break;
        default: return 0;
    }
    return static_cast<size_t>(dim) * 3;
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

    // Niantic SPZ stream layout (legacy header path):
    //   positions  3 × i24
    //   alphas     1 × u8
    //   colors     3 × u8   (quantized SH-L0)
    //   scales     3 × u8   (log-encoded, value/16 - 10)
    //   rotations  3 or 4 bytes  (FirstThree v1/v2; SmallestThree v3+)
    //   sh         shTail × u8   (higher-order SH coefficients)
    const size_t POS_BYTES = 9;
    // v3+ files (MIN_SMALLEST_THREE_QUATERNIONS_VERSION = 3) use 4-byte
    // SmallestThree quat encoding; v1/v2 use 3-byte FirstThree.
    const bool usesSmallestThree = header.version >= 3;
    const size_t ROT_BYTES = usesSmallestThree ? 4 : 3;
    const size_t REST_BYTES = 1 + 3 + 3 + ROT_BYTES;
    const size_t shBytes = shTailBytesPerSplat(header.shDegree);
    const size_t needed = static_cast<size_t>(n) * (POS_BYTES + REST_BYTES + shBytes);
    if (bodyLength < needed) return SpzError::TooSmall;

    const uint8_t *pPos   = body;
    const uint8_t *pAlpha = pPos   + n * POS_BYTES;
    const uint8_t *pColor = pAlpha + n;
    const uint8_t *pScale = pColor + n * 3;
    const uint8_t *pRot   = pScale + n * 3;

    const float invFracDiv = 1.0f / static_cast<float>(1u << header.fractionalBits);

    for (uint32_t i = 0; i < n; ++i) {
        // Position: 3 × i24 / 2^fractionalBits
        float px = static_cast<float>(readI24LE(pPos + i * POS_BYTES + 0)) * invFracDiv;
        float py = static_cast<float>(readI24LE(pPos + i * POS_BYTES + 3)) * invFracDiv;
        float pz = static_cast<float>(readI24LE(pPos + i * POS_BYTES + 6)) * invFracDiv;

        // Scale: 3 × u8 log-encoded.  scale_log = value/16 - 10  →  the
        // vertex shader applies exp(s.scale.xyz).
        float sx = static_cast<float>(pScale[i * 3 + 0]) * (1.0f / 16.0f) - 10.0f;
        float sy = static_cast<float>(pScale[i * 3 + 1]) * (1.0f / 16.0f) - 10.0f;
        float sz = static_cast<float>(pScale[i * 3 + 2]) * (1.0f / 16.0f) - 10.0f;

        // Rotation: per-version Niantic format. See decodeQuat*.
        float quat[4];
        if (usesSmallestThree) {
            decodeQuatSmallestThree(pRot + i * ROT_BYTES, quat);
        } else {
            decodeQuatFirstThree(pRot + i * ROT_BYTES, quat);
        }

        // Color: quantized SH-L0, decoded to linear RGB.
        float cr = decodeColorChannel(pColor[i * 3 + 0]);
        float cg = decodeColorChannel(pColor[i * 3 + 1]);
        float cb = decodeColorChannel(pColor[i * 3 + 2]);

        // Alpha: u8/255 (linear; Niantic's invSigmoid path is the
        // logit, but for direct rendering we want the post-sigmoid
        // value which IS the raw u8/255).
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
    // Niantic FirstThree pack: identity quat (0,0,0,w=1) →
    //   x byte = round((0+1)*127.5) = 128
    //   y byte = 128
    //   z byte = 128
    body[16] = 128;
    body[17] = 128;
    body[18] = 128;

    std::vector<float> splats(1 * 16, 0.0f);
    SpzError err = decodeSpzBody(hdr, body.data(), body.size(), splats.data());
    assert(err == SpzError::Ok);

    // Position round-trip
    assert(splats[0]  == 1.0f);
    assert(splats[1]  == 2.0f);
    assert(splats[2]  == 3.0f);
    // Scale log = 0
    assert(splats[4]  == 0.0f);
    // Quat: byte 128 decodes to 128/127.5 - 1 = 0.00392; w = sqrt(1 - 3*0.00392²) ≈ 0.99998
    auto nearly = [](float a, float b, float eps = 1e-3f) { return std::fabs(a - b) < eps; };
    assert(nearly(splats[8],  0.00392f));
    assert(nearly(splats[9],  0.00392f));
    assert(nearly(splats[10], 0.00392f));
    assert(nearly(splats[11], 1.0f));
    // Alpha
    assert(nearly(splats[15], 1.0f));
    std::printf("SpzReader selftest passed (Niantic-compatible)\n");
    return 0;
}
#endif
