# D.E.C.A. Slate Morph — Phase One Spatial Model

Head-relative frame (viroreact-scene-composition §1): **user head = `[0,0,0]`,
forward = `-Z`, `+X` right, `+Y` up, meters.** All numbers below trace to a real
token, the canonical `ZONES` table, or a cited source line — nothing typed from
memory (§5 anti-pattern).

## Source of every number

| Source | What it gives | Location |
|---|---|---|
| `ZONES` table | zone centers/facings | `viro-external-gui/config/defaults.json` → `zones` (identical to scene-composition §2) |
| comfort rules | 0.3m Z-sep, 0.05m hitbox, 30° cone | `config/defaults.json` → `comfort`; scene-composition §4 |
| `spatialSpacing` | xs .025 / sm .05 / md .1 / lg .2 / xl .35 | viroreact-spatial-layout-system §1.1 |
| `panelSize` | compactCard .45×.28 / standardCard .7×.42 / widePanel 1.2×.72 / theaterPanel 2.4×1.35 | layout-system §1.2 |
| slate default | 1.6×0.9 | `viro-external-core/config/defaults.json` → `slate`; gui → `holographicSlate.dimensions` |
| live input row | 0.62w × 0.085h | `decax9/app/orb-test.tsx:147` |
| orb world pos | `[0,-0.15,-1.8]` | `decax9/app/orb-test.tsx:180-181` (`proxyPos`) |
| orb proxy size | cube `scale 0.55` | `decax9/app/orb-test.tsx:652` |
| live menu pos | `[0.55,-0.45,-1.1]` (hand-typed) | `decax9/app/orb-test.tsx:531` |

**One flagged uncertainty (not guessed):** the native orb glow (orb-pass, drawn
depth-ALWAYS) extends *beyond* the proxy cube by an amount not exposed in TS
(`registerOrbPass` takes no size — `orb-test.tsx:297`). I use the proxy cube's
**circumscribed sphere** as a conservative bounding volume:
`r = 0.55·√3/2 = 0.476m`. The soft additive glow past that is non-occluding light
(`blendMode: 'Add'`, `orb-test.tsx:82`), not a collision solid. If a harder bound
is wanted, confirm the native glow world-radius constant in orb-pass cpp.

---

## 2a. Inventory

| Element | Class | Zone |
|---|---|---|
| D.E.C.A. orb | **ambient presence** (own class) | `presence` (derived, §2c) |
| Slate (pill↔panel↔wide) | content surface (morphing footprint) | `primary` |
| Radial menu / dock | controls | `dock` |

Exactly one element in `primary` (the Slate) — scene-composition §3 Step 2. ✓

---

## 2b. The three Slate states — world-space boxes

The Slate is authored at its `SceneZone name="primary"` local origin, so its
**center is the `primary` zone center `[0,-0.10,-1.5]` in all three states** — the
footprint grows *around* a fixed center (this is what makes the morph read as one
surface, not a jump). Slate is a near-flat quad: Z half-extent ≈ 0.01m.

| State | Token / derivation | W×H (m) | World center | X ext | Y ext | Z ext |
|---|---|---|---|---|---|---|
| **pill** | derived: `width` = live input row 0.62 (`orb-test.tsx:147`); `height` = dock-strip max 0.16 (scene-comp §2), ≥ hitTargetMin 0.04 for input+send | 0.62 × 0.16 | `[0,-0.10,-1.5]` | ±0.31 | ±0.08 | ±0.01 |
| **panel** | `panelSize.widePanel` | 1.2 × 0.72 | `[0,-0.10,-1.5]` | ±0.60 | ±0.36 | ±0.01 |
| **wide** | slate default 1.6×0.9 (core+gui config) | 1.6 × 0.9 | `[0,-0.10,-1.5]` | ±0.80 | ±0.45 | ±0.01 |

**Why `wide` = 1.6×0.9 and NOT `theaterPanel` (2.4×1.35):** at `primary` z=-1.5,
half-width 0.8 subtends `atan(0.8/1.5) = 28.1°` — inside the ±30° horizontal
comfort cone (scene-comp §1). `theaterPanel` half-width 1.2 subtends 38.7° > 30°,
breaking comfort; it is a *cinematic-distance* token, not a 1.5m panel. So the
widest comfortable state is the 1.6×0.9 slate default, which is a real config
number, not invented.

**Zone sizing (§4.5):** the `primary` zone must contain the **wide** box + `sm`
(0.05) margin → 1.6+0.1 = **1.7 × 1.0**. `primary` max footprint is theaterPanel
2.4×1.35 ⊇ 1.7×1.0 ✓.

**Mid-morph clearance argument (required):** same center; `0.62 ≤ 1.2 ≤ 1.6` (X)
and `0.16 ≤ 0.72 ≤ 0.9` (Y). Every intermediate footprint is a subset of the
**wide** box. Therefore **if the wide box clears every neighbor, every frame of the
pill→panel→wide animation clears** — the collision table below only needs to prove
the wide (and pill, as the small endpoint) states.

---

## 2c. The `presence` zone — orb placement, derived + proven

The orb is ambient presence: **not** in `primary` (Slate owns it), **not** in
`dock` (menu owns it). Derive a `presence` zone per scene-comp §2 ("pick a center,
a facing whose normal points at the user, verify no footprint intersection").

- **Current orb** is at `[0,-0.15,-1.8]` (`orb-test.tsx:180`) — but with r=0.476 its
  front reaches z = -1.8+0.476 = **-1.324**, which is *in front of* a Slate at
  z=-1.5. **That collides.** The existing state fails §4.1; Phase One fixes it by
  relocating the orb to a proper `presence` zone.
- **Derived `presence` center:** keep it centered (x=0) and just below eye rest
  (y=-0.15, matching the orb's current Y and inside the ±30° cone at this depth),
  and push Z back until the orb sphere clears the Slate plane by §4.1's 0.3m:
  `z_orb + 0.476 ≤ z_slateBack − 0.3`. Slate back ≈ -1.51 → `z_orb ≤ -2.286`.
  **`presence` = `[0, -0.15, -2.3]`, yaw 0, pitch 0.**
- **Reads as "D.E.C.A. speaking through the panel":** centered on the user's
  forward axis, on a **different depth plane 0.8m behind** primary, so the orb
  glows *through/behind* the Slate rather than beside it — offset in **Z**, per the
  brief's 2c "behind on a different plane" option.
- **Comfort:** at 2.3m the 0.55m orb subtends ~14° (well within cone), depth < 4m
  cap (scene-comp §1). ✓
- **Fixed during morph:** `presence` is independent of Slate state; the orb never
  moves when the Slate morphs (Phase Two constraint). Because the **wide** box
  bounds all intermediate footprints and wide clears the orb (below), growth never
  reaches the orb.

---

## 2d. Menu / dock placement

Assign the radial menu to the canonical **`dock`** zone `[0,-0.55,-1.0]`, pitch
+20° (faces up toward the resting gaze). The live menu is hand-typed at
`[0.55,-0.45,-1.1]` (`orb-test.tsx:531`) — Phase One moves it into `dock` so it is
zone-owned (no hand coords, §5). Dock footprint: strip ≤ 0.9×0.16 (scene-comp §2),
spans y∈[-0.63,-0.47], z≈-1.0.

---

## 2e. Collision-proof table (§4 minimums)

Orb sphere: center `[0,-0.15,-2.3]`, r=0.476 → spans x±0.476, y∈[-0.626,0.326],
z∈[-2.776,-1.824]. Slate (primary): center `[0,-0.10,-1.5]`, z≈-1.5 (thin).
Dock: center `[0,-0.55,-1.0]`, z≈-1.0 (thin), y∈[-0.63,-0.47].

| Pair | Volumes | Sep axis | Clearance | §4 rule | Pass |
|---|---|---|---|---|---|
| orb ↔ pillSlate | sphere r.476 @ z-2.3 · box @ z-1.5 | Z | orb front -1.824 vs slate -1.5 → **0.324m** | §4.1 ≥0.3 | ✓ |
| orb ↔ wideSlate | sphere @ z-2.3 · box @ z-1.5 (thin, X±0.8/Y±0.45) | Z | **0.324m** (Z-sep independent of slate X/Y extent) | §4.1 ≥0.3 | ✓ |
| orb ↔ menu(dock) | sphere @ z-2.3 · strip @ z-1.0 | Z | orb front -1.824 vs dock back -1.0 → **0.824m** | §4.1 ≥0.3 | ✓ |
| menu ↔ pillSlate | strip @ z-1.0 · box @ z-1.5 | Z | **0.5m** | §4.1 ≥0.3 | ✓ |
| menu ↔ wideSlate | strip @ z-1.0 · box @ z-1.5 (Y overlap 0.08) | Z | **0.5m** (Z-sep resolves the Y overlap) | §4.1 ≥0.3 | ✓ |
| orb ↔ nearLeft/Right | sphere @ z-2.3 · reach vol @ z-0.55 | Z | **1.27m** (orb never enters arm's-reach) | §1 envelope | ✓ |

Every pair clears its §4 minimum in pill AND wide (⇒ all intermediate frames, per
2b). No pair fails. Interactive hitboxes (input, send, menu chips, header
close/expand) live in different zones (primary vs dock) on different depth planes,
so §4.3 (0.05m + TouchButton3D 1.4×) is satisfied by zone separation; within the
pill, input↔send spacing is enforced in Phase Two via `StackPanel3D` (horizontal).

---

## 2f. Diagrams

Top-down (looking down +Y), all three Slate footprints overlaid at one center:

```
                         -Z (forward)
                            │
                    [ · presence orb · ]        z=-2.3  (r .476, centered)
                            │
              ┌─────────── wide 1.6 ───────────┐ z=-1.5  ┐
              │      ┌──── panel 1.2 ────┐      │         │ same center
              │      │   ┌ pill .62 ┐    │      │         │ [0,-0.10,-1.5]
              └──────┴───┴──────────┴────┴──────┘         ┘
                          [  dock menu  ]         z=-1.0  (closer, tilted up)
                            │
                    ────────●────────  +X
                       (user head)
```

Side (looking down +X):

```
   +Y
    │
    │        ┌ wide/panel/pill ┐          y≈-0.10, z=-1.5 (faces user)
    │        └─────────────────┘
    ●────────────────────────────── -Z
 (head)      [    dock menu    ]          y≈-0.55, z=-1.0, tilted up 20°
    │
    │              ( · orb · )             y≈-0.15, z=-2.3  (behind the Slate plane)
    │
   floor (y≈-1.6)
```

Orb sits **behind** the Slate plane (further -Z) and centered — glows through the
panel, never beside the menu, never inside a Slate footprint, never in arm's reach.

---

## Phase Two inputs this model hands off

Add to config (no hand coords in components):
- `zones.presence = { position: [0,-0.15,-2.3], yawDeg: 0, pitchDeg: 0 }`
- slate state tokens: `pill {0.62,0.16}`, `panel = panelSize.widePanel`,
  `wide {1.6,0.9}` — all derived above.

Phase Two: one critically-damped spring interpolates W/H/cornerRadius/contentOpacity
between these three boxes on a single `HolographicSlate` surface (settle ≤320ms, no
overshoot), header/content staggered ~80ms behind; orb + menu are static in their
zones. Every mid-morph frame is bounded by the proven `wide` box ⇒ stays clear.
