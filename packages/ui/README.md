# @viro-external/ui

The premium spatial UI layer for Viro.

## SpatialPanel

One panel primitive replaces separate ad-hoc square, rounded and curved panes.

    <SpatialPanel
      title="Lesson"
      subtitle="Biology"
      shape="curved"
      curvature={0.3}
      draggable
      resizable
      headerActions={[
        { id: "save", label: "Save", onPress: save }
      ]}
    >
      ...
    </SpatialPanel>

The panel owns the interaction boundaries that matter in XR:

- draggable chrome
- pinch resizing
- pinned/follow behavior
- close action
- custom working header actions
- square, rounded and curved geometry
- solid and glass variants

## Scroll content

SpatialScrollView uses explicit viewport virtualization and visible up/down controls so it works with text, images, buttons and arbitrary Viro children without requiring an HTML surface.

## Media

VideoPlayerPanel composes @viro-external/media. It is provider-neutral and does not depend on the legacy Mux/Nitro player.

## Rendering on Specs

The same panel tree renders natively through Viro and on Snap Specs through
Lens Studio. Build the panel from the layout and data components. They place
their content with one shared layout (`layout.ts`) on every host:

```tsx
<SpatialPanel title="Harlem Courts" subtitle="Last 7 days" width={0.9} height={0.6}>
  <PanelStack>
    <PanelRow>
      <PanelImage source={{ uri: "img/palace" }} width={0.34} height={0.22} />
      <PanelBarChart data={week} width={0.4} height={0.24} />
    </PanelRow>
    <PanelLabel text="About the courts" variant="heading" />
    <PanelLabel text={about} variant="body" wrap />
  </PanelStack>
</SpatialPanel>
<VideoPlayerPanel source={{ uri: "media/demo" }} width={0.6} height={0.34} />
```

`toPortableScene(tree)` maps the tree to portable XR nodes without rendering
it. On Specs:

- a `SpatialPanel` becomes a UI Kit `Frame` you can grab and corner-resize;
- a `PanelStack` taller than the panel body becomes a scroll window with a
  side scrollbar (▲/▼ and a draggable knob);
- a `VideoPlayerPanel` becomes a Frame that wraps the video at its source
  aspect, with play/pause and seek.

From `@viro-external/specs`, write a scene file and run:

```sh
pnpm specs:scene -- --entry my-scene.tsx --project "/path/to/Lens Project" --parent <root node id>
```

The scene file's default export is the JSX tree. Image and video sources map
to Lens asset registry ids: `{ uri }` and strings pass through as-is, and a
`resolveSource(source, kind)` export handles anything else.
`packages/specs/examples/harlem-courts.tsx` is a complete example.

Components the mapper does not know are left out, with a warning. To map
your own component, register it with `definePortable(Component, mapper)`.
Native scrolling for a variable-height `PanelStack` is not built yet; use
`SpatialScrollView` on native until it is.

## Rive panels

`RivePanel` shows a Rive file with no chrome of its own. Its header and
buttons are in the art. Both hosts use one pipeline: the build reads each
file's clips through the Rive runtime and its buttons from the RML project's
listener hit shapes (`rive inspect`). Then it bakes the clips and plays them
with one state graph:

- Specs: `pnpm specs:scene` bakes into the Lens project.
- Native Viro: `pnpm specs:bake-rive-native -- --entry scene.tsx --out <app assets dir>`
  writes a GIF per clip and an `index.ts`. Pass the entry as
  `<RivePanel baked={RIVE_BAKES[tag]} />`.

Without `baked`, the panel renders the file live through `ViroRivePanel`,
which needs nitro-canvas-in-Vision and keeps data binding. `specs` only
overrides what the build reads: `clips`, `play`, `next`, `onSelect`, and
`actions`, which maps button ids to clips.
