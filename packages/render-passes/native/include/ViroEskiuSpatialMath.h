#pragma once

namespace viroexternal {
namespace renderpasses {

/**
 * C++ declaration for the Eskiu spatial-media math ABI.
 *
 * The functions intentionally remain scalar and allocation-free. The header
 * is safe to include from native rendering code without exposing Eskiu types.
 */
extern "C" {
float vx_spatial_clamp01(float value);
float vx_spatial_lerp(float a, float b, float t);
float vx_spatial_smoothstep(float edge0, float edge1, float x);
float vx_spatial_arc_radius(float width, float arc_radians);
float vx_spatial_arc_sagitta(float width, float arc_radians);
float vx_spatial_radial_layer(float base_radius, float toward_viewer);
}

}  // namespace renderpasses
}  // namespace viroexternal
