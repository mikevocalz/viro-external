//
//  SplatBuffers.h
//  @viro-external/splat-pass
//
//  Triple-buffered SSBO ring for per-frame splat sets + sort keys +
//  indirect draw args. Keeps the GPU consumer one frame ahead of the
//  producer dispatch.
//
//  Layout (std430, see config/defaults.json for the actual sizes):
//
//    Slot 0 — Decoded splats          (DECODED_SPLAT_STRIDE bytes / splat)
//    Slot 1 — Sort keys               (4 bytes / splat,  depth-key << 16 | id)
//    Slot 2 — Indirect draw args      (sizeof(DrawArraysIndirect))
//
//  Slot 0 is triple-buffered (RING_DEPTH = 3). Slots 1 and 2 are
//  ping-pong (RING_DEPTH = 2) because the sort + draw consume the
//  decode output, so any single sort doesn't need to outlive the
//  decode that produced it.
//

#ifndef VIRO_EXTERNAL_SPLAT_SPLATBUFFERS_H
#define VIRO_EXTERNAL_SPLAT_SPLATBUFFERS_H

#include <GLES3/gl31.h>
#include <cstdint>
#include <array>

namespace viroexternal {
namespace splat {

struct DrawArraysIndirectCommand {
    GLuint count;
    GLuint instanceCount;
    GLuint first;
    GLuint baseInstance;
};

class SplatBuffers {
public:
    static constexpr int RING_DEPTH = 3;
    static constexpr int SORT_RING_DEPTH = 2;
    // 64 bytes / splat: pos.xyz pad, scale.xyz alpha, rot quat, color premultiplied rgba.
    // SH coefficients ride a separate SSBO when the source carries them.
    static constexpr GLsizeiptr DECODED_SPLAT_STRIDE = 64;

    SplatBuffers() = default;
    ~SplatBuffers();

    SplatBuffers(const SplatBuffers&) = delete;
    SplatBuffers& operator=(const SplatBuffers&) = delete;

    // Allocate against the configured maxSplats. Idempotent if called
    // with the same count; reallocates on grow.
    bool ensureAllocated(GLsizei maxSplats);

    // Advance the producer ring slot. Call once per decode dispatch.
    void advanceDecode();

    // Advance the sort/draw ring. Call once per sort dispatch.
    void advanceSort();

    // SSBO handles for the current slot.
    GLuint currentDecodedSplats() const { return _decoded[_decodeSlot]; }
    GLuint currentSortKeys()       const { return _sortKeys[_sortSlot]; }
    GLuint currentIndirectArgs()   const { return _indirect[_sortSlot]; }

    // Bytes of each slot (caller does not have to know the math).
    GLsizeiptr decodedBytes() const { return _maxSplats * DECODED_SPLAT_STRIDE; }
    GLsizeiptr sortKeysBytes() const { return _maxSplats * static_cast<GLsizeiptr>(sizeof(GLuint)); }

    GLsizei maxSplats() const { return _maxSplats; }

private:
    void releaseAll();

    GLsizei _maxSplats = 0;
    int _decodeSlot = 0;
    int _sortSlot   = 0;

    std::array<GLuint, RING_DEPTH>      _decoded   { {0, 0, 0} };
    std::array<GLuint, SORT_RING_DEPTH> _sortKeys  { {0, 0} };
    std::array<GLuint, SORT_RING_DEPTH> _indirect  { {0, 0} };
};

}  // namespace splat
}  // namespace viroexternal

#endif  // VIRO_EXTERNAL_SPLAT_SPLATBUFFERS_H
