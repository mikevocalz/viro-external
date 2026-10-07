# Cross-platform wearable UI contract

The XR UI contract is the semantic seam between Viro and wearable vendor stacks.

| Backend | Runtime | Typical input |
| --- | --- | --- |
| Viro | React Native + Viro | gaze, controller, hand, touch |
| Snap Specs | Lens Studio / Snap OS | gaze targeting, pinch, hand |
| Meta Ray-Ban Display | Meta Web Apps / UI Toolkit | D-pad/navigation + glasses activation |
| Meta DAT glasses | paired mobile app + DAT | native device capabilities |

The state model separates visual state (`focused`, `hover`, `pressed`, `disabled`, `checked`) from input source (`gaze`, `pinch`, `dpad`, `controller`, `voice`, `keyboard`). Text input is a host capability and must not be faked by a renderer.

The shared catalog contains names, behavior summaries and mappings only. It does not ship Snap Lens Studio source, Meta UI Toolkit source, Meta fonts, icons or upstream assets.
