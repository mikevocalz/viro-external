# Mux Player — Architecture (module boundaries)

Written after Phase 0 (source-cited seams) + Phase 1 (in-scene HUD). Each
boundary states its **invariant** and the **source seam** it's built on. No
boundary is fixed blind — every Phase-3 increment is verified against the HUD.

Renderer is ViroCore. No DOM / `<canvas>` / WebGL — OES external texture + Viro
`shaderModifier`/materials only.

---

## Observed truth (from the HUD + logs, this session)

- Video **renders** when playing: `renderedFirstFrame(N)` → `STATE_READY` →
  `isPlaying=true`.
- Then it **releases mid-playback**: `STATE_IDLE` → `stop(N): player released`,
  with **no** preceding `ReactNativeJS` remount → native-side teardown. On the
  next interaction it **rebinds** (new `textureId`, `binds:` increments).
- "Blank" = the window between release and rebind. **Not occlusion.**

This is the load-bearing bug and drives boundary #6.

---

## Boundaries

### 1. VideoSurface — owns the OES external texture
- **Seam:** `react-native-viro-mux/src/ViroMuxBridgeSurface.tsx:191-254` (register→poll→play, cleanup stop+release); mesh `:122-135` (`buildCurvedMesh`, texcoords V-flipped `:124-125`). Native bind `HybridViroGPUTextureModule.kt:61-179`.
- **Invariant:** exactly one geometry samples the external material at a time (double-render crashes `VROTexture::getSubstrate` — `MuxPlayerPanel.tsx:787-790`). Chrome never draws over it.
- **Q1 (alpha):** *not* an OES-sampler limitation — the OES is a compile-time `sampler2D→samplerExternalOES` rewrite (`VROShaderFactory.cpp:941`, `VROExternalSurfaceTexture.h:59`). The video material defaults to `VROBlendMode::Alpha` (`VROMaterial.cpp:52`) → transparent bucket → sorts ambiguously against alpha chrome on a near plane. **Lever:** keep chrome ≥0.3m off the video plane (composition rule) **or** set the video material opaque so it sorts first. Either lifts "chrome fades over video."

### 2. Chrome — opaque, own plane, hosts the HUD
- **Seam:** control bar `MuxPlayerPanel.tsx:889-1100`; header `PanelHeader3D.tsx`; HUD `MuxDebugHUD.tsx`.
- **Invariant:** opaque materials, ≥0.3m off the video plane (Q1). The HUD proved this boundary renders legibly off-video (Phase-1 pass). **Transport controls live here and are a permanent requirement — never removed.**

### 3. Drawer — own zone, slides laterally clear, never behind the user
- **Seam:** `MuxPlayerPanel.tsx:798-834` (arc + flat containers), rows `:719-770`.
- **Invariant (Q3):** the **curved (`ViroGeometry`) path is the shipped one** (decax9 mounts `curvature={0.35}` → `arcF` truthy `:320`); the flat `ViroQuad` path runs only at `curvature=0`. Row hit-tests miss because the curved row plate is custom geometry — fix with a flat additive-black `hitStrip` per row (the seek bar's proven pattern, `M.hitStrip :165`), NOT by making the drawer opaque-white (that caused the white-screen + drawer-from-behind). Slide must be **lateral, in front of the video plane** — never a scale-from-origin or a −Z pose (both read as "from behind").
- **Reveal must not use animated opacity over the video** (Q1 sort) — use position + a mount/`visible` gate, verified on the curved path via the HUD `drawer:` field.

### 4. Transport — playback controls, opaque chrome
- **Seam:** `MuxPlayerPanel.tsx:900-1099` + the restored cluster (`skip-back·rewind·play/pause·fast-forward·skip-forward`) wired to `seekTo`/relative-seek/track-switch. Icons via `scripts/gen-icons.mjs`.
- **Invariant:** always present; opaque; no alpha over video. **Skip does NOT flip to immersive** (auto-360-on-skip surfaced the upside-down sphere).

### 5. ImmersiveController — owns 360, two SEPARATE invariants
- **Seam:** `MuxPlayerPanel.tsx:1112-1176` (blackout + video sphere + exit pill).
- **5a Orientation (Q2 — corrected):** the sphere **already** applies `scale={[1,-1,1]}` V-flip with `cullMode:"None"` (`:1140`, comment `:1106-1111`) — so orientation is a **texture/UV concern**, handled. If it still reads inverted on-device, the fix stays in the flip layer (V-mirror), never a scene transform. *(My Phase-0 draft missed line 1140; corrected here — verify orientation via the HUD `rot:` euler before touching it.)*
- **5b Guaranteed exit — safety-critical:** the exit affordance (`:1149-1176`) currently lives inside the immersive subtree that the failing feature renders. **It must not.** Move it to a system-level, recenter-anchored, always-present escape that exists independent of playlist/360 state and does not depend on the transport chrome. Model on tracking-loss recovery: the escape hatch cannot depend on the feature that's failing.

### 6. PlaybackLifecycle — deterministic bind/persist (THE active bug)
- **Seam:** `ViroMuxBridgeSurface.tsx:191-254` (JS register/poll/release) + `HybridViroGPUTextureModule.kt:85` (posted `bind` w/ `BIND_ATTEMPTS`), `:131-160` (`bind` gives up if `resolveViroView().viroContext`/material null), `:103-123` (async release).
- **Q4 root:** on cold opens `bind` races the async ViroView registration and can exhaust `BIND_ATTEMPTS` → `surfaceReady` never set → poll times out → no playback until a later open ("3rd open").
- **New root (this session):** during playback the native player hits `STATE_IDLE` and the surface releases **without a JS remount** → intermittent blank + rebind. → **investigate the native IDLE trigger** (`ViroMuxPlayerModule.kt` — end-of-media without loop re-arm? error? an unintended `stop()`?) before any fix. `// UNVERIFIED — native STATE_IDLE→stop trigger`.
- **Invariant:** the surface binds once and **persists** across transient player states; `bind` keys off ViroView-ready deterministically (lazy-bind on registration, not a fixed attempt budget); `STATE_IDLE` mid-playback must re-prepare, not tear down the surface.

---

## Flat-path decision (Q3)

**Delete the flat `ViroQuad` path?** Pending one check: grep all consumers for a
`MuxPlayerPanel`/`ViroMuxBridgeSurface` mount with `curvature={0}` (or omitted →
default `curvature = 0` in `MuxPlayerPanel.tsx:253`, but decax9 passes `0.35`).
- If **no** consumer ships `curvature=0` → delete the flat branch; it's dead
  weight causing arc/flat drift (halves the surface area I kept mis-fixing).
- If any consumer relies on flat → keep, but add a HUD `mode:` assertion so
  drift is caught immediately.
**Decision:** confirm consumers in Phase 3 step 0, then delete if safe.

---

## Phase-3 increment order (one variable each, HUD-verified)

1. **PlaybackLifecycle** — stop the mid-playback `STATE_IDLE`→release (the active blank). Verify: HUD `state:` stays `playing`; `binds:` stops climbing.
2. **VideoSurface/Chrome** — video opaque-bucket OR chrome ≥0.3m off-plane; HUD legible, no fade-over-video.
3. **Drawer** — curved-path `hitStrip` select + lateral slide; HUD `drawer:` flips, taps log `playlist →`.
4. **ImmersiveController** — guaranteed always-present exit FIRST (safety), then confirm `rot:`-verified orientation.
5. **Flat-path delete** if Phase-3 step 0 confirms no `curvature=0` consumer.

---

## Phase-3 results (2026-07-08, verified on Quest 3S via argent logcat forensics)

1. **PlaybackLifecycle — RESOLVED by root cause, no code fix needed.**
   Register/cleanup logging added to `ViroMuxBridgeSurface` proved every
   `STATE_IDLE → stop(N): player released` is preceded by the JS effect cleanup
   (`[VXMUX] surface CLEANUP`) — the ONLY caller of native `stop()`. There is
   NO spontaneous native teardown: the "mid-playback release" was the
   radial-menu Player button acting as a toggle (full panel unmount). Lifecycle
   is deterministic: unmount→teardown, reopen→rebind+position-restore (~1.3s to
   first frame). Keep the lifecycle logs — they make any future release
   attributable.
2. **VideoSurface — DONE.** `createPlaceholderMaterial` sets
   `blendMode: "None"` → video sorts in the opaque bucket before alpha chrome
   (Q1 lever).
3. **Drawer — DONE.** Flat additive-black hitStrip quad per curved row
   (`polarPose(arcF, 0, 0.014)`, the seek bar's pattern) — custom
   `ViroGeometry` plates are not reliably hit-testable on the fork.
4. **ImmersiveController exit — DONE (clickability).** The exit pill's plate is
   custom geometry (same miss bug) — a `ViroQuad` hitStrip now guarantees the
   click. Moving the pill out of the panel subtree to a recenter-anchored
   system overlay remains open (today it is panel-relative, like the sphere).
5. **Flat-path delete — DEFERRED.** decax9 is the only consumer (curvature
   0.35); deleting the flat branch is a wide refactor across every `arcF`
   ternary — do it as its own change, not mid-session.

**Hit-surface standard** (every invisible hit quad/box/strip):
`{ diffuseColor: black, lightingModel: Constant, blendMode: Add,
writesToDepthBuffer: false }`, opacity ≥0.15, positioned IN FRONT of
custom-geometry plates. Missing depth-write-off carves phantom boxes over the
360 background; behind-the-plate placement makes only icons clickable.
