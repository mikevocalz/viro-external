# @viro-external/gui — Premium Spatial-UI Fidelity Upgrade

Design + fidelity doc for upgrading the gui spine (`Control3D`, `Button3D`,
panels) to premium material/geometry fidelity **in place**. Renderer is
ViroCore. No DOM, `<canvas>`, `document`, or WebGL/WebGPU — the shader work is
Viro `shaderModifier` GLSL; the texture tier is the RN-Skia→ViroSlate/GPUTexture
path. (The linked `webgpu-threejs-tsl` skill does **not** apply — different
renderer; using WGSL/TSL here would be invented-API slop.)

## 0. Honest fidelity ceiling (VERIFIED against source, not assumed)

| Tier | Viro reality (file:line) | Status |
|---|---|---|
| Layout + material **language** (glass fills, nested radii, depth, bolder type) | Skia texture tier via `ViroSlate`/`ViroGPUTexture` (`viro-external-core/src/ViroSlate.tsx`) + material props (`ViroMaterials.ts:127-154`) | **FAITHFUL — match precisely** |
| **Geometry depth** (extruded/beveled buttons, edge-thick panels) | `buildCylinderGeometry.ts` exists; **NO extrusion/bevel builder** → new `viro-external-core` deliverable | **FAITHFUL — must BUILD it** |
| **Fluent shader** (fresnel rim, emissive floor, pointer-tracked specular) | `shaderModifiers?: ViroShaderModifiers` real (`ViroMaterials.ts:113-119,154`); runtime feed via `ViroMaterials.updateShaderUniform` (`ViroMaterials.ts:256`, live use `Studio/domain/useStudioShaderTimeUniforms.ts:41`); register with `materialUniforms` (`ViroMaterials.ts:155`) | **APPROXIMATION — label as such, never "Babylon fluent parity"** |
| True passthrough **refraction** (glass sampling the real room) | `requiresCameraTexture` auto-binds ARCore `camera_texture` (`ViroMaterials.ts:106-110`) — but that's the AR *camera* feed, not verified to bind PICO OpenXR passthrough; not a cheap seam | **SEAM — out of scope, do NOT fake** |

**Anti-slop statement (binding):** the pointer-tracked highlight below is a
**fresnel/emissive/pointer-highlight approximation** driven by Viro hover
events + a per-frame uniform. It is NOT Babylon fluent-shader parity and NOT
true Liquid-Glass refraction. Any doc/PR/commit that claims otherwise is wrong.

## 1. Verified API contract (the seam we build on)

- **Shader stages** (`ViroMaterials.ts:113-119`): `ViroShaderModifiers = { geometry?, vertex?, surface?, fragment?, lightingModel? }`; each is `string | { body?, uniforms?, varyings?[], requiresSceneDepth?, requiresCameraTexture? }` (`:94-111`).
- **Runtime uniform feed** (`ViroMaterials.ts:256`): `ViroMaterials.updateShaderUniform(materialName, name, "float"|"vec2"|"vec3"|"vec4"|"mat4"|"sampler2D", value)`. Uniforms must be **registered** at creation via `materialUniforms: ViroShaderUniform[]` (`:121-125,155`).
  - ⚠️ **On-device caveat:** `Studio/domain/materialConfig.ts:110-111` documents the register-then-update requirement as **iOS-worded**. Android/PICO behavior is UNVERIFIED — it MUST be confirmed on-device before claiming the pointer sweep works (profile step §6). If Android ignores `updateShaderUniform`, the highlight degrades to a static fresnel+emissive material (still an upgrade) and the pointer-track becomes a SEAM.
- **First-class material props usable without GLSL** (`ViroMaterials.ts:127-153`): `fresnelExponent`, `shininess`, `lightingModel: PBR`, `roughness`, `metalness`, `bloomThreshold`, `reflectiveTexture` (cubemap), `blendMode`, `writesToDepthBuffer`. Prefer these where they suffice; reach for `shaderModifiers` only for the pointer-tracked term.
- **Pointer position source** (`Control3D.tsx:50-63`): Viro `onHover(isHovering, worldPos)` already surfaces the hover world-position; `onPointerEnter({position})` forwards it. This is the driver for the highlight uniform — no invented event.

## 2. Existing spine (upgrade in place — do NOT rewrite)

- `Control3D.tsx` — owns hover/press state + **scale-only** response; comment `:29` explicitly defers material response to "Wave 2" (this work). Pointer position already captured (`:55`). **Upgrade:** add material-uniform feed (`u_pointer`, `u_hover`, `u_press`) + emissive/scale lift, keep the scale.
- `Button3D.tsx` — flat `ViroQuad` + `createPlaceholderMaterial` (`:56-84`) + centered `ViroText`; texture path stubbed (`contentResolution`/`contentScaleRatio`/`imageUrl` `void`ed `:52-54`). **Upgrade:** extruded/beveled mesh geometry + shaderModifier material + SDF-glass label surface.
- `MeshButton3D.tsx`, `HolographicButton.tsx` — pre-existing mesh/holographic variants to reconcile (read before duplicating).
- Tokens live in `viroreact-spatial-layout-system` (`spatialSpacing`, `panelSize`, `distance`, `typeScale`, `materialToken`) + local `decaTheme.ts`/`materials.ts`/`config/defaults.json`. **Extend these**, no parallel token set.

## 3. shaderModifier uniform contract (to implement)

Registered via `materialUniforms` at `createMaterials`; fed by `Control3D` on hover/press. Every uniform traces to a token + a driving event:

| Uniform | type | driven by | token |
|---|---|---|---|
| `u_pointer` | vec2 | `Control3D` hover → surface-local UV of `onHover` worldPos | — (live) |
| `u_hover` | float | hover enter/out (0→1, damped in JS) | `control.hoverEmissive` |
| `u_press` | float | click down/up (0→1) | `control.pressEmissive` |
| `u_rimColor` | vec3 | static | `theme.glassRim` |
| `u_emissiveFloor` | float | static | `theme.emissiveFloor` |

Fragment/surface GLSL (approximation): `fresnel = pow(1 - dot(N,V), u_fresnelExp)` → rim; `+ u_emissiveFloor`; `+ specular * smoothstep(radius, 0, distance(uv, u_pointer)) * u_hover`. Commented, every term labeled "approximation."

## 4. Scoped implementation order (each increment profiled on PICO before the next — §6 72fps gate)

1. **Tokens** — extend layout-system material set + `decaTheme`: glass fills, glow, bevel depths, fresnel/emissive/highlight params, hover/press transforms.
2. **Control3D** — material-uniform feed + emissive lift (keep scale). Smallest, highest-leverage; unblocks everything.
3. **Button3D shader** — shaderModifier material (fresnel + emissive + pointer highlight) on the existing quad. Profile: static vs hover vs press.
4. **Extrusion/bevel builder** in `viro-external-core` (the flagged gap) → Button3D real geometry.
5. **Texture tier** — SDF rounded-rect glass label via ViroSlate/GPUTexture (replace placeholder).
6. **Panels** — glass fills, edge thickness, depth-layered children, text washes.

## 5. Budget / risk

- Device profile gate: **72fps** with a full panel of upgraded buttons at rest/hover/press in a realistic scene (orb + drawer + player). Measured cost recorded here per increment. A frame-dropping visual is a regression (`viroreact-device-quality-profiles`).
- Primary risk: the Android `updateShaderUniform` caveat (§1). Increment 2 verifies it on-device before increments 3+ depend on it.
