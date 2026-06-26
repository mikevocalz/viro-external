//
//  GLStateScope.h
//  @viro-external/splat-pass
//
//  RAII save/restore for the subset of GL state the splat pass mutates.
//  Restores against Viro's frame-boundary contract (verified
//  ViroRenderer/VRODriverOpenGL.h:80-96), not against zero-initialized
//  defaults — Viro re-establishes its own state at the top of every
//  frame, so we save what's CURRENT when the pass enters and restore
//  it on the way out. That keeps subsequent passes (bloom, tone-map)
//  uncorrupted regardless of what we did in between.
//
//  Naked glEnable/glDisable outside this scope is a review block per
//  packages/splat-pass/CLAUDE.md.
//

#ifndef VIRO_EXTERNAL_SPLAT_GLSTATESCOPE_H
#define VIRO_EXTERNAL_SPLAT_GLSTATESCOPE_H

#include <GLES3/gl31.h>

namespace viroexternal {
namespace splat {

class GLStateScope {
public:
    GLStateScope();
    ~GLStateScope();

    GLStateScope(const GLStateScope&) = delete;
    GLStateScope& operator=(const GLStateScope&) = delete;

private:
    // Capability flags
    GLboolean _depthTest;
    GLboolean _blend;
    GLboolean _cullFace;
    GLboolean _stencilTest;

    // Depth
    GLboolean _depthWriteMask;
    GLint     _depthFunc;

    // Blend
    GLint     _blendSrcRGB;
    GLint     _blendDstRGB;
    GLint     _blendSrcAlpha;
    GLint     _blendDstAlpha;
    GLint     _blendEquationRGB;
    GLint     _blendEquationAlpha;

    // Buffer / program bindings
    GLint     _activeProgram;
    GLint     _arrayBuffer;
    GLint     _vertexArray;
    GLint     _drawFramebuffer;
    GLint     _readFramebuffer;

    // Texture unit + binding on unit 0 (the #436 placeholder lands here).
    GLint     _activeTexture;
    GLint     _textureBinding2D_unit0;
};

}  // namespace splat
}  // namespace viroexternal

#endif  // VIRO_EXTERNAL_SPLAT_GLSTATESCOPE_H
