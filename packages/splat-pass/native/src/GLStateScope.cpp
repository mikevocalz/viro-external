//
//  GLStateScope.cpp
//  @viro-external/splat-pass
//

#include "GLStateScope.h"

namespace viroexternal {
namespace splat {

GLStateScope::GLStateScope() {
    // Capabilities
    _depthTest   = glIsEnabled(GL_DEPTH_TEST);
    _blend       = glIsEnabled(GL_BLEND);
    _cullFace    = glIsEnabled(GL_CULL_FACE);
    _stencilTest = glIsEnabled(GL_STENCIL_TEST);

    // Depth state
    glGetBooleanv(GL_DEPTH_WRITEMASK, &_depthWriteMask);
    glGetIntegerv(GL_DEPTH_FUNC,      &_depthFunc);

    // Blend state
    glGetIntegerv(GL_BLEND_SRC_RGB,        &_blendSrcRGB);
    glGetIntegerv(GL_BLEND_DST_RGB,        &_blendDstRGB);
    glGetIntegerv(GL_BLEND_SRC_ALPHA,      &_blendSrcAlpha);
    glGetIntegerv(GL_BLEND_DST_ALPHA,      &_blendDstAlpha);
    glGetIntegerv(GL_BLEND_EQUATION_RGB,   &_blendEquationRGB);
    glGetIntegerv(GL_BLEND_EQUATION_ALPHA, &_blendEquationAlpha);

    // Program + buffers + FBO
    glGetIntegerv(GL_CURRENT_PROGRAM,           &_activeProgram);
    glGetIntegerv(GL_ARRAY_BUFFER_BINDING,      &_arrayBuffer);
    glGetIntegerv(GL_VERTEX_ARRAY_BINDING,      &_vertexArray);
    glGetIntegerv(GL_DRAW_FRAMEBUFFER_BINDING,  &_drawFramebuffer);
    glGetIntegerv(GL_READ_FRAMEBUFFER_BINDING,  &_readFramebuffer);

    // Texture unit + unit-0 binding (the #436 guard slot).
    glGetIntegerv(GL_ACTIVE_TEXTURE,            &_activeTexture);
    glActiveTexture(GL_TEXTURE0);
    glGetIntegerv(GL_TEXTURE_BINDING_2D,        &_textureBinding2D_unit0);
    glActiveTexture(static_cast<GLenum>(_activeTexture));
}

GLStateScope::~GLStateScope() {
    // Restore unit-0 texture binding via a transient switch to unit 0,
    // then restore whichever unit was active when we entered.
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, static_cast<GLuint>(_textureBinding2D_unit0));
    glActiveTexture(static_cast<GLenum>(_activeTexture));

    // FBO + buffers + program
    glBindFramebuffer(GL_DRAW_FRAMEBUFFER, static_cast<GLuint>(_drawFramebuffer));
    glBindFramebuffer(GL_READ_FRAMEBUFFER, static_cast<GLuint>(_readFramebuffer));
    glBindVertexArray(static_cast<GLuint>(_vertexArray));
    glBindBuffer(GL_ARRAY_BUFFER, static_cast<GLuint>(_arrayBuffer));
    glUseProgram(static_cast<GLuint>(_activeProgram));

    // Blend
    glBlendEquationSeparate(static_cast<GLenum>(_blendEquationRGB),
                            static_cast<GLenum>(_blendEquationAlpha));
    glBlendFuncSeparate(static_cast<GLenum>(_blendSrcRGB),
                        static_cast<GLenum>(_blendDstRGB),
                        static_cast<GLenum>(_blendSrcAlpha),
                        static_cast<GLenum>(_blendDstAlpha));

    // Depth
    glDepthFunc(static_cast<GLenum>(_depthFunc));
    glDepthMask(_depthWriteMask);

    // Capabilities
    if (_depthTest)   glEnable(GL_DEPTH_TEST);   else glDisable(GL_DEPTH_TEST);
    if (_blend)       glEnable(GL_BLEND);        else glDisable(GL_BLEND);
    if (_cullFace)    glEnable(GL_CULL_FACE);    else glDisable(GL_CULL_FACE);
    if (_stencilTest) glEnable(GL_STENCIL_TEST); else glDisable(GL_STENCIL_TEST);
}

}  // namespace splat
}  // namespace viroexternal
