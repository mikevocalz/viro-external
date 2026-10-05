# Wearable UIKit

`@viro-external/ui` now exposes a vendor-neutral wearable UI surface for Viro.

The Viro implementation is behavioral rather than source-compatible with Snap or Meta: it provides the same semantic building blocks while vendor-specific rendering, focus/navigation, and native services stay in their backend adapters.

## SPECS UI Kit parity

The tracked SPECS UI Kit surface is BackPlate, Frame, BaseButton/RectangleButton, CapsuleButton, RoundButton, Checkbox, RadioButton, ScrollBar, ScrollWindow, Slider, ConfirmationSlider, Switch, ToggleGroup/SwitchToggleGroup, GridLayout, and TextInputField. The corresponding Viro surface is exported as `Glasses*` components.

## Meta Ray-Ban Display parity

Meta's current UI Toolkit for Meta Ray-Ban Display exposes a larger React surface. The common components are represented in `@viro-external/xr-contract`; the Viro package covers the portable core while directional focus, display-specific metrics, and native window lifecycle remain Meta adapter concerns.

## Text input

`GlassesTextInput` provides display + activation semantics, not a fake keyboard. A host application supplies the actual keyboard/text-input bridge.

## Upstream

- https://github.com/specs-devs/context
- https://github.com/specs-devs/samples
- https://github.com/facebook/meta-ray-ban-display-ui-toolkit-web
- https://github.com/facebook/meta-wearables-webapp
- https://github.com/facebook/meta-wearables-dat-ios
