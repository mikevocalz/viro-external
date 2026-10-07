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

// Rive spatial-surface math: scalar equivalents of the TS adapter helpers in
// packages/ui/src/RiveNativeHost.ts. Axis semantics match RiveDragAxis
// (0 = free, 1 = horizontal, 2 = vertical); fit 0 = contain, 1 = cover.
float vx_rive_delta_length(float dx, float dy, float dz);
float vx_rive_clamp_scale(float dx, float dy, float dz, float maxLen);
float vx_rive_axis_component(float value, int axis, int component);
float vx_rive_fit_scale(float w, float h, float cw, float ch, int fit);
float vx_rive_center_offset(float surface, float content);
float vx_rive_uv_from_hit(float hit, float extent);
}

}  // namespace renderpasses
}  // namespace viroexternal
