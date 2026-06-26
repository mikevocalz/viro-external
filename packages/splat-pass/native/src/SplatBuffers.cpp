//
//  SplatBuffers.cpp
//  @viro-external/splat-pass
//

#include "SplatBuffers.h"

namespace viroexternal {
namespace splat {

namespace {
void allocateSSBO(GLuint handle, GLsizeiptr bytes, GLenum usage) {
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, handle);
    glBufferData(GL_SHADER_STORAGE_BUFFER, bytes, nullptr, usage);
    glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);
}
}  // namespace

SplatBuffers::~SplatBuffers() {
    releaseAll();
}

void SplatBuffers::releaseAll() {
    for (auto& h : _decoded)  { if (h) { glDeleteBuffers(1, &h); h = 0; } }
    for (auto& h : _sortKeys) { if (h) { glDeleteBuffers(1, &h); h = 0; } }
    for (auto& h : _indirect) { if (h) { glDeleteBuffers(1, &h); h = 0; } }
    _maxSplats = 0;
}

bool SplatBuffers::ensureAllocated(GLsizei maxSplats) {
    if (maxSplats <= 0) return false;
    if (maxSplats == _maxSplats) return true;

    releaseAll();
    _maxSplats = maxSplats;

    for (auto& h : _decoded) {
        glGenBuffers(1, &h);
        allocateSSBO(h, decodedBytes(), GL_DYNAMIC_DRAW);
    }
    for (auto& h : _sortKeys) {
        glGenBuffers(1, &h);
        allocateSSBO(h, sortKeysBytes(), GL_DYNAMIC_DRAW);
    }
    for (auto& h : _indirect) {
        glGenBuffers(1, &h);
        glBindBuffer(GL_DRAW_INDIRECT_BUFFER, h);
        const DrawArraysIndirectCommand zero{0, 0, 0, 0};
        glBufferData(GL_DRAW_INDIRECT_BUFFER,
                     sizeof(DrawArraysIndirectCommand),
                     &zero, GL_DYNAMIC_DRAW);
        glBindBuffer(GL_DRAW_INDIRECT_BUFFER, 0);
    }

    _decodeSlot = 0;
    _sortSlot   = 0;
    return true;
}

void SplatBuffers::advanceDecode() {
    _decodeSlot = (_decodeSlot + 1) % RING_DEPTH;
}

void SplatBuffers::advanceSort() {
    _sortSlot = (_sortSlot + 1) % SORT_RING_DEPTH;
}

}  // namespace splat
}  // namespace viroexternal
