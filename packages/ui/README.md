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


## Spatial workspace

Use `worldSlot()` or `SpatialWorkspaceSlotNode` for the shared LEFT / CENTER / RIGHT Viro composition.

```tsx
<SpatialWorkspaceSlotNode
  slot="left"
  headPosition={settledHead.position}
  headYawDeg={settledHead.yawDeg}
>
  <SpatialPanel title="Lessons">
    <LessonList />
  </SpatialPanel>
</SpatialWorkspaceSlotNode>
```

The default workspace places panels on a 2.6 m comfort arc with 28 degree side offsets. Placement should be computed from a **settled** head pose, not recomputed from every head-tracking frame.

Keep one carrier node around everything that belongs to a panel: rendered surface, pointer/hit plane, header/chrome, toolbar, tray and drag affordance. This prevents interaction surfaces from drifting away from the visible panel.

This engine-level layout is intentionally separate from OS-level Meta `SpatialWindow` and PICO `WindowContainer`/Subwindow presentation. The shared XR contract decides which presentation is appropriate.


## Web interaction parity

The premium UI uses the same Viro component tree on web.

With the companion Viro web input work:

- `SpatialPanel draggable` uses normal `ViroNode.onDrag`;
- `pinchToScale` uses normal `ViroNode.onPinch`;
- `SpatialScrollView` accepts mouse-wheel and trackpad scrolling through normal `ViroNode.onScroll`;
- explicit up/down scroll buttons remain available for controller/gaze use;
- flat/rounded/curved geometry, text, images, materials, hover/click and billboarding already render through Viro Web.

Runtime dependency: web drag/pinch/scroll requires the updated Viro web bridge and ViroCore WASM exports from the corresponding web-parity PRs. Older binaries continue rendering panels but do not emit the new interaction events.
