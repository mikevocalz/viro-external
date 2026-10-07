# Cross-platform XR interaction contract

The interaction contract separates semantic UI behavior from platform input.

Shared phases include hover, focus, select, press, long-press, drag, grab,
release, scroll, swipe and cancel.

Viro maps spatial pointers, gaze, controllers and hands into the contract.

Specs / SIK / ESIK is exposed through SpecsESIKUIAdapter. The native runtime
remains responsible for hit testing, interactability and manipulation. The
adapter only normalizes events for portable components.

Meta Ray-Ban Display maps D-pad focus/navigation and display activation into
the same semantic phases.

Design rule: normalize intent, not hardware. Specs pinch and Meta D-pad
confirmation can both activate a button, but they remain different sources.
