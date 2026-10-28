/**
 * Wearer-facing copy for the experience layer, keyed as in viro
 * `docs/ux/copy.md`. Generated from viro `components/Specs/core/copy.ts`;
 * `scripts/experience.test.mjs` checks it against `scripts/fixtures/copy.json`,
 * which is exported from the same file. Code references keys, never strings.
 *
 * Dependency-free and free of Lens globals.
 */
export const VIRO_SPECS_LENS_COPY = {
  "loading.title": "Loading scene",
  "loading.progress": "Loading {done} of {total}",
  "loading.slow": "Still loading. Large models can take a moment.",
  "loading.a11yLabel": "Loading scene, {percent} percent",
  "degraded.worldQuery.unsupported": "Placement isn't available on this device. Content stays in front of you.",
  "degraded.worldQuery.unavailable": "Can't find surfaces right now. Try a brighter spot or look at a table or floor.",
  "degraded.handTracking.permission": "Hand tracking is off. Look at a button and hold your gaze to select.",
  "degraded.handTracking.unavailable": "Can't see your hands. Hold them in view, or select with your gaze.",
  "degraded.unverified": "Some features haven't been checked on this device.",
  "degraded.dismiss": "Got it",
  "error.asset.title": "Model didn't load",
  "error.asset.message": "The rest of the scene works. Retry to load it again.",
  "error.asset.action": "Retry",
  "error.scene.title": "Scene couldn't open",
  "error.scene.message": "The last working scene is still here.",
  "error.scene.action": "Close",
  "error.sceneNoFallback.title": "Scene couldn't open",
  "error.sceneNoFallback.message": "Close this lens and open it again. If it keeps happening, the code below helps the developer.",
  "error.sceneNoFallback.action": "Close",
  "error.transport.title": "Lost connection to the app",
  "error.transport.message": "What's here stays. Changes will show when it reconnects.",
  "error.transport.action": "Got it",
  "placement.searching": "Look at a table or the floor",
  "placement.surface": "{surface}. Pinch to place.",
  "placement.surfaceUnknown": "Look for a flat surface",
  "placement.confirmed": "Placed",
  "placement.cancelHint": "Look away to cancel",
  "placement.cancelled": "Placement cancelled",
  "placement.a11yLabel": "Placement reticle on {surface}",
  "permission.handTracking.title": "Hand tracking is off",
  "permission.handTracking.body": "Turn it on in Spectacles settings to pinch and drag. You can still select with your gaze.",
  "permission.handTracking.body.noGaze": "Turn it on in Spectacles settings to use this scene.",
  "permission.action.continue": "Use gaze instead",
  "permission.action.close": "Close",
  "gallery.hello.title": "Hello",
  "gallery.placement.title": "Placement",
  "gallery.interaction.title": "Interaction",
  "gallery.navigation.title": "Navigation",
  "nav.back": "Back",
  "nav.next": "Next scene",
  "modelViewer.reset": "Reset model",
  "gallery.hello.body": "This scene runs the same Viro JSX as the phone.",
  "gallery.hello.model": "Shiba model",
  "gallery.interaction.body": "Pinch a button. Drag the model.",
  "gallery.interaction.optionA": "Option A",
  "gallery.interaction.optionB": "Option B",
  "gallery.interaction.optionC": "Option C",
  "gallery.interaction.retry": "Retry",
  "gallery.interaction.retryFailed": "That didn't go through. Pinch Retry to try again.",
  "gallery.navigation.card": "Card {n}",
  "gallery.navigation.cardBody": "Change the setting below, then go back. The list keeps your place.",
  "gallery.navigation.showLabels": "Show labels",
  "surface.floor": "Floor",
  "surface.table": "Table",
  "surface.wall": "Wall",
  "surface.seat": "Seat",
  "surface.ceiling": "Ceiling",
  "placement.placeHere": "Place here",
  "placement.placeAgain": "Place again",
  "placement.cancelling": "Cancelling",
  "button.loading": "Working",
  "gaze.moveLeft": "Move left",
  "gaze.moveRight": "Move right",
  "gaze.moveCloser": "Move closer",
  "gaze.moveAway": "Move away",
  "gaze.scrollUp": "Scroll up",
  "gaze.scrollDown": "Scroll down",
  "error.assetMany.title": "{n} models didn't load",
  "a11y.selected": ", selected",
  "a11y.unavailable": ", unavailable",
  "a11y.placeholder": "{label}, didn't load",
} as const;

/** A key of {@linkcode VIRO_SPECS_LENS_COPY}. */
export type ViroSpecsCopyKey = keyof typeof VIRO_SPECS_LENS_COPY;

/**
 * The copy for `key` with `{name}` placeholders filled from `params`. A
 * placeholder without a value stays as written so it is visible in review.
 */
export function formatViroSpecsCopy(key: ViroSpecsCopyKey, params: Readonly<Record<string, string | number>> = {}): string {
  return VIRO_SPECS_LENS_COPY[key].replace(/\{(\w+)\}/g, (match: string, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
