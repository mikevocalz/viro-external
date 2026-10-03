# @viro-external/ui

Spatial UI for Viro: panels, headers, buttons, scrolling, layout and data
components, and video and Rive panels. The same component tree renders
natively through Viro and on Snap Specs through Lens Studio. On Specs,
`toPortableScene` maps the tree to portable XR nodes at build time, and
`pnpm specs:scene` (in `@viro-external/specs`) turns those into a Lens scene.

Units are meters. Positions are relative to the parent, origin at the centre,
+y up. Rotations are Viro Euler degrees.

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
```

`packages/specs/examples/harlem-courts.tsx` is a complete scene using most
of this package.

## Contents

- [Layout](#layout): constants and functions shared by native and Specs
- [SpatialPanel](#spatialpanel)
- Layout components: [PanelStack](#panelstack), [PanelRow](#panelrow), [PanelLabel](#panellabel), [PanelSurface](#panelsurface)
- Content: [PanelImage](#panelimage), [PanelText](#paneltext)
- Data: [PanelBarChart](#panelbarchart), [PanelStat](#panelstat)
- Controls: [PanelHeader](#panelheader), [PanelButton](#panelbutton), [SpatialScrollView](#spatialscrollview)
- Media: [VideoPlayerPanel and SpatialVideoPlayerPanel](#videoplayerpanel-and-spatialvideoplayerpanel), [MuxSpatialPlayerPanel](#muxspatialplayerpanel)
- [RivePanel](#rivepanel)
- [Rendering on Specs](#rendering-on-specs): `toPortableScene`, `definePortable`, Viro primitives
- [Native and Specs differences](#native-and-specs-differences)

## Layout

`layout.ts` holds the layout both hosts use, so content lands in the same
place natively and on Specs.

| Export | Value / signature | Meaning |
| --- | --- | --- |
| `PANEL_HEADER_HEIGHT` | `0.1` | Header band at the top of a titled panel. |
| `PANEL_PADDING` | `0.04` | Inset between the panel edge and its content. |
| `PANEL_GAP` | `0.03` | Default space between stacked or row items. |
| `PANEL_TYPE` | `{ title, heading, figure, label, body, caption }` | Per text variant: `specsScale` (multiplier of the Specs runtime's base label), native `fontSize`, and `lineHeight` in meters. |
| `panelBody(width, height, hasHeader)` | `{ centerY, width, height }` | The content area under the header. |
| `panelHasHeader(props)` | `boolean` | True unless `title`, `subtitle` and `headerActions` are all absent and `showPinAction` and `showCloseAction` are both `false`. |
| `panelHeader(height)` | `{ titleY, subtitleY }` | Header title and subtitle centres. |
| `stackLayout(heights, top, gap?)` | `{ centers, height }` | Top-down column: each item's centre y from a top edge, and the total height. |
| `rowLayout(widths, width, gap?)` | `number[]` | Each item's centre x in a centred left-to-right row. |
| `paragraphHeight(text, width, variant?)` | `number` | Height of a wrapped paragraph, estimated from character count (about 95 body characters per 0.82 m line, scaled by width). |

Type sizes in `PANEL_TYPE`:

| Variant | `specsScale` | `fontSize` | `lineHeight` |
| --- | --- | --- | --- |
| `title` | 3.2 | 30 | 0.045 |
| `heading` | 2.2 | 22 | 0.035 |
| `figure` | 3 | 28 | 0.04 |
| `label` | 1.7 | 18 | 0.026 |
| `body` | 1.5 | 16 | 0.017 |
| `caption` | 1.4 | 14 | 0.022 |

Components that can sit in a `PanelStack` or `PanelRow` are `Measurable`:
they carry a static `measure(props, available)` that returns
`{ width, height }`. `measureElement(element, available)` calls it, and
returns `{ width: 0, height: 0 }` for anything without one. `PanelBodyContext`
carries the enclosing panel's body to its children.

## SpatialPanel

The panel primitive: square, rounded or curved geometry, a header with
pin/follow and close actions, dragging and pinch-to-resize.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `title` | `string` | | Header title. |
| `subtitle` | `string` | | Header subtitle. |
| `shape` | `"square" \| "rounded" \| "curved"` | `"rounded"` | Panel geometry. |
| `variant` | `"solid" \| "glass"` | `"solid"` | Panel material. |
| `width` | `number` | `1.6` | Width in meters. |
| `height` | `number` | `1` | Height in meters. |
| `cornerRadius` | `number` | `0.06` | Corner radius for `rounded`. |
| `curvature` | `number` | `0.32` | Bend for `curved`. |
| `segments` | `number` | `36` | Segments for `curved`. |
| `draggable` | `boolean` | `true` | Movable, unless `movable` is set. |
| `resizable` | `boolean` | `true` | Pinch to scale, unless `pinchToScale` is set. |
| `defaultPinned` | `boolean` | `true` | Start pinned. Unpinned panels billboard on Y. |
| `headerActions` | `PanelHeaderAction[]` | `[]` | Extra header buttons, before pin and close. |
| `showPinAction` | `boolean` | `true` | Show the Pin/Follow button. |
| `showCloseAction` | `boolean` | `true` | Show the close button. |
| `onPinnedChange` | `(pinned: boolean) => void` | | Called when pin state changes. |
| `onClose` | `() => void` | | Called after the panel closes itself. |
| `position` / `rotation` / `scale` | `Vec3` | | Transform. |
| `children` | `ReactNode` | | Panel body content. |
| `movable`, `tag`, `dragType`, `dragPlane`, `axisLock`, `onMoveStart`, `onMove`, `onMoveEnd`, `pinchToScale` | from `MovableProps` (`@viro-external/core`) | `tag`: `"vxp-spatial-panel"` | Passed to `MovableNode`. `tag` is also the panel's node id on Specs. |

```tsx
<SpatialPanel
  title="Lesson"
  subtitle="Biology"
  shape="curved"
  curvature={0.3}
  headerActions={[{ id: "save", label: "Save", onPress: save }]}
>
  <PanelStack>...</PanelStack>
</SpatialPanel>
```

The header sits inside the panel's top edge, as on Specs. Children render in
front of the panel with `PanelBodyContext` set to `panelBody(...)`.

**On Specs:** a `panel` node, which the Lens runtime draws as a UI Kit
`Frame` you can grab and corner-resize, tinted with the native panel colour.
Title and subtitle become text nodes at `panelHeader` positions with the
`title` and `caption` type scales. If the panel's only child is a
`PanelStack` taller than the body, the stack goes into a `scroll` node (a UI
Kit `ScrollWindow` with a side scrollbar) 0.04 m narrower than the body.
Other children are placed in the body as they are. `shape`, `variant`, the
header actions, pin and close are not mapped.

## PanelStack

A top-down column. In a panel it starts at the body's top edge; nested in a
stack or row it is centred on its origin.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Items, placed by their measured heights. |
| `gap` | `number` | `PANEL_GAP` | Space between items. |

Measures as wide as its widest item and as tall as its items plus gaps.

```tsx
<PanelStack gap={0.012}>
  <PanelImage source={{ uri: "img/palace" }} width={0.34} height={0.22} />
  <PanelLabel text="Rucker Park, 155th St" variant="caption" />
</PanelStack>
```

**On Specs:** no node of its own; each child is mapped at its `stackLayout`
centre. A panel's single overflowing stack becomes a scroll window (see
SpatialPanel). Natively, overflow is neither clipped nor scrolled yet.

## PanelRow

Items side by side, centred, sharing the row's height.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `children` | `ReactNode` | | Items, placed by their measured widths. |
| `gap` | `number` | `PANEL_GAP` | Space between items. |

Measures the full available width and the height of its tallest item.

```tsx
<PanelRow>
  <PanelStat value="159" caption="games this week" width={0.24} />
  <PanelStat value="41" caption="Saturday peak" width={0.24} />
</PanelRow>
```

**On Specs:** no node of its own; each child is mapped at its `rowLayout` x.

## PanelLabel

A line or paragraph of text sized by variant.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `text` | `string` | | The text. |
| `variant` | `PanelTextVariant` | `"label"` | Size from `PANEL_TYPE`. |
| `wrap` | `boolean` | `false` | Wrap into a paragraph; height from `paragraphHeight`. |
| `width` | `number` | available width | Box width. A single line without `width` does not widen its container. |
| `color` | `string` | `"#F7F8FC"` | Text colour (native only). |

Wrapped text, or a line with a `width`, is left-aligned; otherwise centred.

```tsx
<PanelLabel text="About the courts" variant="heading" />
<PanelLabel text={about} variant="body" wrap />
```

**On Specs:** a `text` node scaled by the variant's `specsScale`. Wrapped or
width-set labels are anchored at the box's top-left with `wrapWidthMeters`,
because Lens lays wrapped text from the top-left down. `color` is not mapped.

## PanelSurface

A raised tile with its content centred on it.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `width` | `number` | | Tile width. |
| `height` | `number` | | Tile height. |
| `children` | `ReactNode` | | Content. |

```tsx
<PanelSurface width={0.78} height={0.088}>
  <PanelRow gap={0.02}>...</PanelRow>
</PanelSurface>
```

**On Specs:** a `surface` node (a flat tinted rectangle, no Frame) with a
0.012 m corner radius; children are mapped with the tile's width.

## PanelImage

A fixed-size image. Measurable.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `source` | `{ uri: string } \| number` | | Image source. |
| `width` | `number` | | Width. |
| `height` | `number` | | Height. |
| `position` | `Vec3` | | Offset from where the layout places it. |

```tsx
<PanelImage source={{ uri: "img/palace" }} width={0.34} height={0.22} />
```

**On Specs:** an `image` node with `fit: "cover"`. The source goes through
`resolveSource(source, "image")`; with no id it is left out with a warning.

## PanelText

A fixed-size text box. Measurable.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `text` | `string` | | The text. |
| `width` | `number` | | Box width. |
| `height` | `number` | | Box height. |
| `position` | `Vec3` | | Offset. |
| `color` | `string` | `"#F7F8FC"` | Text colour. |
| `align` | `"left" \| "center" \| "right"` | `"left"` | Horizontal alignment. |
| `weight` | `"normal" \| "400" \| "500" \| "600" \| "700" \| "bold"` | `"normal"` | Font weight. |

```tsx
<PanelText text="Open now" width={0.3} height={0.04} align="center" />
```

**On Specs:** a `text` node at the `label` scale. `color`, `align` and
`weight` are not mapped. Prefer `PanelLabel` for new layouts.

## PanelBarChart

A bar chart. `barChartLayout(props)` computes every bar's geometry and is
shared by the native chart and the Specs mapper.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `data` | `readonly { label: string; value: number }[]` | | Bars. |
| `width` | `number` | | Chart width. |
| `height` | `number` | | Chart height, including value and label bands. |
| `highlightPeak` | `boolean` | `true` | Colour the largest bar with the accent. |

```tsx
<PanelBarChart data={[{ label: "Mon", value: 12 }, { label: "Tue", value: 18 }]} width={0.4} height={0.24} />
```

**On Specs:** one `surface` node per bar (peak bar in the accent colour)
plus `caption` text nodes for each value and label.

## PanelStat

A tile with a large figure over a caption.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `value` | `string` | | The figure. |
| `caption` | `string` | | Caption under it. |
| `width` | `number` | | Tile width. |
| `height` | `number` | `0.11` | Tile height. |

```tsx
<PanelStat value="+18%" caption="vs last week" width={0.24} />
```

**On Specs:** a `surface` tile, a `figure` text node and a `caption` text node.

## PanelHeader

The header band `SpatialPanel` draws. Usable on its own.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `width` | `number` | | Header width. |
| `height` | `number` | `0.12` | Header height. `SpatialPanel` passes `PANEL_HEADER_HEIGHT`. |
| `title` | `string` | | Title, left-aligned. |
| `subtitle` | `string` | | Subtitle under the title. |
| `actions` | `PanelHeaderAction[]` | `[]` | Buttons on the right. |
| `position` | `Vec3` | | Position. |

`PanelHeaderAction` is `{ id: string; label: string; onPress: () => void; disabled?: boolean }`.

```tsx
<PanelHeader width={1.2} title="Settings" actions={[{ id: "done", label: "Done", onPress: close }]} />
```

**On Specs:** no mapper. Inside a `SpatialPanel` the mapper writes the title
and subtitle itself; a standalone `PanelHeader` is left out with a warning.

## PanelButton

A quad button with hover and disabled states.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `label` | `string` | | Button text. |
| `onPress` | `() => void` | | Called on click, unless disabled. |
| `disabled` | `boolean` | `false` | Disabled look, no click. |
| `width` | `number` | `0.18` | Width. |
| `height` | `number` | `0.07` | Height. |
| `position` | `Vec3` | | Position. |

```tsx
<PanelButton label="Play" width={0.22} onPress={() => player.togglePlay()} />
```

**On Specs:** no mapper; left out with a warning. For a press target on
Specs, use a `ViroNode` (or another mapped primitive) with `onClick`, which
the mapper turns into an interaction.

## SpatialScrollView

A list scroller for native Viro: it shows a window of fixed-height items,
with up/down buttons and a rail. It works with any Viro children.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `width` | `number` | | Viewport width. |
| `height` | `number` | | Viewport height. |
| `itemHeight` | `number` | | Height of each item; visible count is `floor(height / itemHeight)`. |
| `children` | `ReactNode` | | Items. |
| `position` | `Vec3` | | Position. |
| `step` | `number` | `1` | Items moved per button press. |
| `showRail` | `boolean` | `true` | Draw the rail and thumb. |
| `onIndexChange` | `(index: number) => void` | | Called with the first visible index. |

```tsx
<SpatialScrollView width={0.8} height={0.4} itemHeight={0.1}>
  {rows.map((row) => <PanelLabel key={row.id} text={row.title} />)}
</SpatialScrollView>
```

**On Specs:** no mapper; left out with a warning. On Specs, a `PanelStack`
taller than its panel scrolls instead.

## VideoPlayerPanel and SpatialVideoPlayerPanel

A `SpatialPanel` around a `@viro-external/media` video, with a 360/2D header
action and Play/Pause, Mute/Unmute, -10s, +10s and Replay buttons. The
header subtitle shows status and time. Closing the panel releases the player.

`SpatialVideoPlayerPanel` takes a player you own:

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `player` | `SpatialVideoPlayer` | | Player from `@viro-external/media`. |
| `tag` | `string` | | Stable node id on Specs. |
| `title` | `string` | `"Video"` | Header title. |
| `width` | `number` | `1.8` | Width. |
| `height` | `number` | `1.18` | Height. |
| `shape` | `SpatialPanelShape` | `"rounded"` | Panel geometry. |
| `presentation` | `"flat" \| "curved" \| "360"` | `"flat"` | Initial presentation. |
| `curvature` | `number` | `0.32` | Bend for curved panels and video. |
| `position` / `rotation` | `Vec3` | | Transform. |
| `onStatusChange` | `(snapshot: SpatialVideoPlayerSnapshot) => void` | | Player snapshot updates. |
| `onClose` | `() => void` | | Called after close. |

`VideoPlayerPanel` creates the player from a source. It takes every prop
above except `player`, plus:

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `source` | `MediaSource` (`string \| { uri } \| MuxMediaSource`) | | Video source. |
| `defaultPaused` | `boolean` | `false` | Start paused. |
| `defaultMuted` | `boolean` | `false` | Start muted. |
| `defaultLoop` | `boolean` | `false` | Loop. |

```tsx
<VideoPlayerPanel tag="courtside" title="Courtside" source={{ uri: "media/demo" }} width={0.6} height={0.34} />
```

**On Specs:** a `panel` node (UI Kit Frame) and a `video` child with
`fit: "contain"` and `controls: true`. The Lens runtime fits the video to
its source's aspect, wraps the Frame around it, and draws its own control
bar (play/pause, a seek track, time readout). The source goes through
`resolveSource(source, "video")`. `SpatialVideoPlayerPanel` has no `source`
prop, so it maps only if one is passed; otherwise it is left out with a
warning. Title, presentation and the native buttons are not mapped.

## MuxSpatialPlayerPanel

A `SpatialPanel` around `MuxSpatialPlayer`, with mode and quality header
actions (quality cycles Auto, 720p, 1080p, 1440p, 2160p) and
Play/Pause, -10s, +10s and Mute/Unmute buttons.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `source` | `MuxMediaSource \| string` | | Mux source or playback id. |
| `title` | `string` | `"Video"` | Header title. |
| `width` | `number` | `1.85` | Width. |
| `height` | `number` | `1.2` | Height. |
| `shape` | `SpatialPanelShape` | `"rounded"` | Panel geometry. |
| `presentation` | `VideoPresentation` | `"flat"` | Initial presentation. |
| `curvature` | `number` | `0.32` | Bend. |
| `position` / `rotation` | `Vec3` | | Transform. |
| `autoPlay` | `boolean` | `false` | Start playing. |
| `muted` | `boolean` | `false` | Start muted. |
| `loop` | `boolean` | `false` | Loop. |
| `poster` | `MuxPosterSource` | `true` | Poster image. |
| `posterTime` | `number` | | Poster frame time. |
| `onStatusChange` | `(status: SpatialPlayerStatus) => void` | | Status updates. |
| `onClose` | `() => void` | | Called after close. |

```tsx
<MuxSpatialPlayerPanel source={{ provider: "mux", playbackId }} autoPlay muted />
```

**On Specs:** no mapper; left out with a warning. Use `VideoPlayerPanel`
with a Mux source for a scene that must render on both hosts (the default
`resolveSource` passes `playbackId` through).

## RivePanel

A Rive file as a spatial panel with no chrome of its own: the art draws its
header and buttons. It has two native modes and one Specs mode.

| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `tag` | `string` | `"vxp-rive-panel"` | Stable node id; also the key in `RIVE_BAKES`. |
| `width` | `number` | `1.2` | Width. |
| `height` | `number` | `0.75` | Height. |
| `position` / `rotation` | `Vec3` | | Transform. |
| `draggable` | `boolean` | `true` | Pinch to move. |
| `rive` | `RiveNativeProps` | | Live mode: `ViroRivePanelProps` without geometry. |
| `baked` | `RiveBaked` | | Baked mode: output of `specs:bake-rive-native`. Takes precedence over `rive`. |
| `onButtonPress` | `(id: string) => void` | | Called with a button id when a baked button is pressed. |
| `specs` | `RiveSpecsProps` | | What the build bakes. Required for Specs and for native baking. |

**Live mode (`rive`).** `ViroRivePanel` from the fork renders the file
through the canvas runtime, with data binding and the file's own listeners.
It needs nitro-canvas-in-Vision.

**Baked mode (`baked`).** One `ViroAnimatedImage` plays the current clip's
GIF, fitted at the artboard's aspect. The rules match the Specs runtime: a
looping clip repeats; a one-shot clip moves to `next[clip]` after its baked
length; a click on the art moves to `onSelect[clip]`; each button is a quad
over its hit area that highlights on hover and press and plays its clip.

`specs` fields (`RiveSpecsProps`):

| Field | Type | Meaning |
| --- | --- | --- |
| `file` | `string` | The `.riv` file, relative to the scene file. |
| `artboard` | `string` | Artboard to bake. |
| `project` | `string` | RML project directory; the build runs `rive inspect` on it to find buttons. |
| `inspect` | `string` | A saved `rive inspect --json` output, used instead of `project`. |
| `clips` | `Record<string, string \| { animation: string; loop?: boolean }>` | Clips to bake. Default: every animation in the artboard with its own loop mode. A string clip does not loop. |
| `play` | `string` | First clip. Default: the first looping clip, else the first clip. |
| `next` | `Record<string, string>` | Clip to move to when a one-shot clip ends. |
| `onSelect` | `Record<string, string>` | Clip to move to on a select (pinch or tap) on the art. |
| `buttons` | `RiveButton[]` | Buttons by hand: `{ id, label, rect: [x, y, w, h] in artboard pixels from the top-left, play? }`. Overrides discovery. |
| `actions` | `Record<string, string>` | Which clip each button id plays. |
| `resolution` | `number` | Baked frame width in pixels. |
| `maxFrames` | `number` | Frame cap when clips are discovered (240 if unset). |

**Discovery.** The build reads each file instead of assuming its contents.
Clips and the artboard size come from the Rive runtime (run in headless
Chromium). Buttons come from the shapes the RML project's listeners hit,
through `rive inspect` (`project`) or a saved inspect JSON (`inspect`).
Without either and without `buttons`, the panel has no button targets.
Anything set in `specs` overrides what was read. The build warns when an
`actions` id has no button or a button targets a clip that was not baked,
and fails when a clip names an animation the file lacks.

```tsx
<RivePanel
  tag="lesson"
  width={0.56}
  height={0.35}
  rive={{ source: { rivBytes, stateMachine: "QuestionFlow" } }}
  baked={RIVE_BAKES.lesson}
  specs={{
    file: "assets/moyo_learning_question.riv",
    inspect: "assets/moyo_learning_question.inspect.json",
    clips: { Loading: { animation: "EntranceLoading", loop: true }, Entering: "Entering", Idle: "Idle" },
    play: "Loading",
    next: { Entering: "Idle" },
    onSelect: { Loading: "Entering" },
    actions: { retry: "Entering" },
  }}
/>
```

**Baking for native.** From `packages/specs`:

```sh
pnpm specs:bake-rive-native -- --entry scene.tsx --out <app assets dir>
```

This writes a GIF per clip under `<out>/<panel tag>/` and `<out>/index.ts`
exporting `RIVE_BAKES: Record<string, RiveBaked>`. Pass an entry as
`baked={RIVE_BAKES[tag]}`. Rerun it after changing a Rive file.

**On Specs:** a `panel` node (Frame, no header) and a `rive` child with
source `rive/<id>-rive`. `pnpm specs:scene` bakes the clips into one GIF in
the Lens project and fills in the clip frame ranges, frame count, first clip
and buttons. A `RivePanel` without `specs` is left out with a warning. GIF
has 1-bit alpha, so frames are drawn over the panel colour.

## Rendering on Specs

### toPortableScene

```ts
toPortableScene(tree: React.ReactNode, options?: ToPortableOptions): PortableSceneResult
```

Walks the JSX tree without rendering it, so hooks and native modules never
run. Placement comes from `layout.ts` and each component's `measure`.

`ToPortableOptions`:

| Field | Type | Meaning |
| --- | --- | --- |
| `parentId` | `string` | Parent node id for the top-level elements. |
| `resolveSource` | `(source: unknown, kind: "image" \| "video" \| "model") => string \| undefined` | Turns a native source into a Lens asset registry id. Default: strings pass through, `require()` numbers become `"react-native-asset:<n>"`, objects give `uri`, `url` or `playbackId`. |
| `animations` | `Record<string, { properties?, duration?, delay?, easing? }>` | The ViroAnimations registrations the scene uses. Pass the same object you register. |

`PortableSceneResult` has `nodes`, `riveBakes`, `polylines`,
`interactions`, `animations` and `diagnostics` (warnings, one string each).

Node ids come from `viroTag`, then `tag`, then an author-set `key`, else
`<prefix>-<n>` (for example `panel-1`). Set `tag` or `viroTag` on anything
the Lens side or a test needs to find.

Components without a mapper are left out of the Specs scene with the
diagnostic `No Specs mapping for <Name>; it is left out of the Specs scene.`
Fragments are flattened.

### definePortable

```ts
definePortable<P>(component: unknown, mapper: (props: P, place, ctx, element) => void): void
```

Registers how a component appears on Specs. The built-in components use it.
A mapper reads `props`, pushes nodes onto `ctx.nodes` (or `ctx.interactions`,
`ctx.animations`, `ctx.polylines`, `ctx.diagnostics`), and receives `place`:
`{ parentId, origin, width, world, inPanel }`, where `origin` is the
element's centre in its parent and `width` is the width available to it. The
mapper must run before `toPortableScene`, so register it in a module the
scene file imports.

```tsx
import { definePortable } from "@viro-external/ui";

export function Badge({ text }: { text: string }) { /* native rendering */ }

definePortable<{ text: string }>(Badge, (props, place, ctx) => {
  ctx.nodes.push({
    id: "badge-" + props.text,
    kind: "text",
    text: props.text,
    position: place.origin,
    ...(place.parentId ? { parentId: place.parentId } : {}),
  });
});
```

To lay out inside a `PanelStack` or `PanelRow`, also give the component a
static `measure(props, available)` (see `Measurable`).

### Viro primitives

The mapper handles these Viro components directly. Nodes keep their local
transform (rotation converted to a quaternion) and their `parentId`, as the
fork's compiler emits them. Inside a panel, a primitive without its own
`position` sits where the layout put it.

| Component | Portable output |
| --- | --- |
| `ViroNode` | `group` node; children mapped under it. |
| `ViroText` | `text` node from `text`. |
| `ViroImage` | `image` node; source via `resolveSource(source, "image")`. |
| `Viro3DObject` | `model` node; source via `resolveSource(source, "model")`. |
| `ViroPolyline` | A world-space `volumetric-line` (Lens `VolumetricLine`), radius `thickness / 2` (default thickness 0.01) times world scale, first material as `materialId`. Left out inside a panel, because Lens draws route lines in world space and the line would not follow the panel. |

**Interactions.** On any of the node primitives, `onHover` adds a `hover`
event, `onClick` or `onClickState` adds `select`, and `onDrag` adds `drag`
and turns on manipulation. The Lens side wires these through SIK
Interactables.

**Animations.** An `animation={{ name, run, loop, delay }}` prop becomes a
Lens `AnimationPlayer` plan when `name` is in the `animations` option and
`run` is not `false`. Properties map as `positionX/Y/Z`,
`scaleX/Y/Z`, `rotateX/Y/Z` to transform tracks and `opacity` to
`material.opacity`. Easing `Linear`, `EaseIn`, `EaseOut` and `EaseInEaseOut`
(any case, with or without hyphens) are supported. `duration` and `delay`
are milliseconds; the animation's `delay` adds to the registration's. Only
absolute values work: a relative value such as `"+=0.1"` is skipped with a
warning, as are unknown properties and easings.

```tsx
export const animations = {
  pulse: { properties: { scaleX: 1.15, scaleY: 1.15, scaleZ: 1.15, opacity: 0.8 }, duration: 500, easing: "EaseInEaseOut" },
};

<ViroText viroTag="title" text="Hello" animation={{ name: "pulse", run: true, loop: true }} />
```

## Native and Specs differences

- **Panel chrome.** Natively, `SpatialPanel` draws its own geometry and
  header buttons. On Specs, a panel is a UI Kit `Frame`: grab to move,
  corner zones to resize, with the panel colour drawn behind the content.
  Shape, variant, header actions, pin and close are native only.
- **Header.** On both hosts the header sits inside the panel's top edge, and
  `panelBody` gives the same content area.
- **Scrolling.** On Specs, a panel whose only child is a `PanelStack` taller
  than the body scrolls in a `ScrollWindow` with a side scrollbar (up/down
  buttons and a knob you can pinch and drag). Natively, `PanelStack`
  overflow is not clipped or scrolled yet; use `SpatialScrollView` until it
  is.
- **Clipping.** Flat `ViroText` cannot be clipped by a shader, so text
  natively cannot be cut at a scroll edge the way the Lens ScrollWindow
  clips its content.
- **Not mapped to Specs.** `PanelHeader` (standalone), `PanelButton`,
  `SpatialScrollView` and `MuxSpatialPlayerPanel` have no mapper and are
  left out with a warning.
- **Text styling.** Specs text uses the `PANEL_TYPE` scales; `color`,
  `align` and `weight` props are native only.
