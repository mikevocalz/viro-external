# Composition — title bar as grab handle

Babylon `HolographicSlate` separates the **content area** (where 2D content lives) from the **title bar / chrome** (where movability lives). Grabbing the content does not move the slate — only grabbing the title bar does.

`ViroSlate` mirrors this:

- When `movable={true}`, the slate's wrapping `MovableNode` is attached to a **title-bar sub-region**, not the whole surface.
- The title bar is a thin slab at the top of the slate (height = ~6% of `heightMeters`, default `0.06 × heightMeters`) using the standard Viro click/drag pattern on a separate `ViroQuad`.
- The content area uses `ignoreEventHandling={true}` (verified prop on `ViroCommonProps`) so it never receives drag events.

This makes the slate feel like a window, not a draggable mesh.

## Defaults

Tunables in `config/defaults.json` (`slate.*`):

| Key                    | Default          | Why |
| ---------------------- | ---------------- | --- |
| `widthMeters`          | 1.6              | Comfortable reading width at arm's length. |
| `heightMeters`         | 0.9              | 16:9 aspect by default. |
| `fboResolution`        | 1024×576         | Sane default; consumer should scale to content density. |
| `colorSpace`           | `srgb`           | Matches content rendered through React Native's RGB pipeline. |
