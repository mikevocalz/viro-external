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
