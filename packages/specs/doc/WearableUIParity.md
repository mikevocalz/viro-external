# SPECS UI parity

This adapter tracks the public SPECS UI Kit surface without copying Lens Studio implementation source.

| SPECS UI Kit | Shared contract | Viro surface |
| --- | --- | --- |
| BackPlate | backplate | GlassesBackplate |
| Frame | frame | GlassesFrame |
| BaseButton | button | GlassesButton |
| RectangleButton | rectangle-button | GlassesRectangleButton |
| RoundButton | round-button | GlassesRoundButton |
| CapsuleButton | capsule-button | GlassesCapsuleButton |
| Checkbox | checkbox | GlassesCheckbox |
| RadioButton | radio-button | GlassesRadioButton |
| ScrollBar | scroll-bar | GlassesScrollBar |
| ScrollWindow | scroll-window | GlassesScrollWindow |
| Slider | slider | GlassesSlider |
| ConfirmationSlider | confirmation-slider | GlassesConfirmationSlider |
| Switch | switch | GlassesSwitch |
| TextInputField | text-input | GlassesTextInput |
| ToggleGroup | toggle-group | GlassesToggleGroup |
| GridLayout | grid-layout | GlassesGridLayout |

The `specs-devs/samples` collection is used as behavioral reference material for interaction composition. SPECS-specific SIK, World Query, Navigation Kit, Sync Kit, camera permissions and Lens Studio lifecycle remain behind `@viro-external/specs`.
