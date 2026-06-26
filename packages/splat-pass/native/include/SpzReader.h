// SpzReader.h
//
// Minimal SPZ container reader. Validates the header (magic, version,
// shape) and surfaces the on-disk layout slices so the GPU decode pass
// (splat_decode.comp) can DMA them straight into SSBOs.
//
// Format reference: github.com/nianticlabs/spz README.md ("Format" §).
// Header is fixed 16 bytes:
//   uint32 magic       = 'NGSP' (0x5053474e LE)
//   uint32 version     = 2 | 3
//   uint32 numPoints
//   uint8  shDegree    ∈ {0, 1, 2, 3}
//   uint8  fractionalBits
//   uint8  flags       bit0 = antialiased
//   uint8  reserved    = 0
//
// We do NOT do CPU-side bit-unshuffle here — that's a separate
// pass-through that lands when the GPU decode shader needs raw blocks.

#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace viroexternal {
namespace splat {

struct SpzHeader {
    uint32_t magic;
    uint32_t version;
    uint32_t numPoints;
    uint8_t  shDegree;
    uint8_t  fractionalBits;
    uint8_t  flags;
    uint8_t  reserved;

    bool antialiased() const { return (flags & 0x01u) != 0u; }
};

constexpr uint32_t SPZ_MAGIC = 0x5053474eu;   // 'NGSP' little-endian
constexpr size_t   SPZ_HEADER_BYTES = 16;

enum class SpzError {
    Ok,
    TooSmall,
    BadMagic,
    UnsupportedVersion,
    UnsupportedShDegree,
};

struct SpzReadResult {
    SpzError error;
    SpzHeader header;
    /** Byte offset to the start of the quantized per-splat block. */
    size_t bodyOffset;
};

/**
 * Validate and return the SPZ header. Does NOT decode or copy the body.
 * Caller-owned buffer must live for the SpzReadResult's lifetime.
 */
SpzReadResult readSpzHeader(const uint8_t *data, size_t length);

/** Human-readable error string. */
const char *spzErrorString(SpzError error);

/**
 * Decode the SPZ body (positions + alphas + colors + scales + rotations)
 * directly into the raster shader's `Splat` struct (64 bytes per splat):
 *   vec4 position   (xyz + pad)
 *   vec4 scale      (xyz log-scale + alpha)
 *   vec4 rotation   (unit quat xyzw)
 *   vec4 color      (premultiplied RGBA)
 *
 * Output is 16 × float32 per splat. Caller-allocated buffer must hold
 * at least `header.numPoints * 16` floats.
 *
 * Returns Ok on success. SH coefficients are skipped (length-validated
 * only) — shDegree > 0 is accepted but the SH tail is unused until the
 * raster shader gains view-dependent shading.
 */
SpzError decodeSpzBody(const SpzHeader &header,
                       const uint8_t *body, size_t bodyLength,
                       float *outSplats);

/** Bytes per decoded splat record. Mirrors the raster shader's Splat struct. */
constexpr size_t DECODED_SPLAT_BYTES = 16 * sizeof(float);

}  // namespace splat
}  // namespace viroexternal
