# RiveSpatialSurface

`createRiveSpatialSurface` is the native Rive integration boundary for Viro.

It intentionally does not wrap `RiveView` in a `ViroNode`. A React Native view and a Viro scene node belong to different native rendering hierarchies.

The target architecture is:

- physical width/height/depth
- Viro transform
- Viro hit target
- Viro depth/occlusion
- native Rive artboard/state machine
- ESIK/Viro normalized pointer events

Example:

    const rive = createRiveSpatialSurface(riveAdapter, {
      source: { kind: "url", uri: "https://cdn.example.com/ui.riv" },
      artboard: "HUD",
      stateMachine: "Main",
      width: 1.4,
      height: 0.8,
      depth: 0.025,
      depthMode: "embedded",
      interactive: true,
    });

    rive.dispatchPointer({
      phase: "down",
      source: "pinch",
      uv: [0.5, 0.5],
      timestamp: performance.now(),
    });

The adapter must use a native Rive renderer. Do not replace it with a screenshot, WebView, GIF, PNG sequence or JS canvas.
