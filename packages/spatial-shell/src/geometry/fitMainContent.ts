/**
 * A frame inside a measured host, in the host's units.
 *
 * @see {@linkcode fitMainContent}
 */
export interface MainContentRect {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly top: number;
}

/**
 * The largest frame of `aspectRatio` (width / height) that fits a `width` x
 * `height` host, centred. Undefined while the host has no valid size yet.
 *
 * Horizon OS and PICO OS 5 let the user resize the main panel to any shape,
 * and the manifest cannot stop that: Android ignores `minAspectRatio` and
 * `maxAspectRatio` on resizeable activities. Laying the content out in this
 * frame keeps it at the launch aspect on both headsets and leaves the window
 * bounds, and so the rail window and the detail panel, alone. Ported from
 * MoyoLearn (`apps/mobile/src/spatial/main-content-geometry.ts`) by way of
 * expo-pico #45.
 *
 * @throws {RangeError} When `aspectRatio` is not a positive finite number.
 */
export function fitMainContent(
  width: number,
  height: number,
  aspectRatio: number
): MainContentRect | undefined {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    throw new RangeError(`[spatial-shell] aspect ratio must be a positive number, got ${aspectRatio}.`);
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  const contentWidth = Math.min(width, height * aspectRatio);
  const contentHeight = contentWidth / aspectRatio;
  return {
    width: contentWidth,
    height: contentHeight,
    left: (width - contentWidth) / 2,
    top: (height - contentHeight) / 2,
  };
}
