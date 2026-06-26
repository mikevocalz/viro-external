#version 310 es
precision highp float;

// Splat raster fragment stage.
//
// Evaluates the 2D Gaussian alpha at the fragment's screen-space offset
// from the projected splat centre, multiplies by the splat's stored
// alpha, and emits premultiplied colour for blending.
//

in vec4 v_color;     // premultiplied RGBA from vertex
in vec2 v_uv;        // pixel offset from projected centre
in vec3 v_conic;     // inverse 2D covariance (a, b, c)
flat in uint v_splatId;

layout(location = 0) out vec4 fragColor;

// Tunable alpha cutoff — matches config/defaults.json::alphaThreshold.
// Anything below this contributes effectively nothing to the final
// pixel, so we discard it to skip the blend hardware cost.
const float ALPHA_CUTOFF = 0.0039;

void main() {
    // Mahalanobis distance: x^T * Σ^-1 * x for the 2D vector x = v_uv.
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
    // v_color is premultiplied; scale by per-fragment alpha modulation.
    fragColor = vec4(v_color.rgb * gauss, alpha);
}
