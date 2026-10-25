import type { Camera, GeoId, Store, Styles } from "@quickdrawjs/core";

/**
 * Measures one line of board text, in page units at `fontSizePx`.
 *
 * QuickDraw sizes text and note shapes from font metrics. The browser editor
 * reads them from Canvas2D; a headless board has no canvas, so the host
 * supplies the same measurement from the platform's text engine.
 *
 * @see {@linkcode HeadlessBoardOptions.measureTextWidth}
 */
export type MeasureTextWidth = (
  text: string,
  font: { fontSizePx: number; fontFamily: string },
) => number;

/**
 * Options for `createHeadlessBoard`.
 */
export interface HeadlessBoardOptions {
  /**
   * The QuickDraw document. The board writes every edit to it through
   * `transact`, `put`, `update`, `remove` and `beginBatch`/`endBatch`, exactly
   * as QuickDraw's `Editor` does. Remote and tutor edits keep entering through
   * `store.applyDiff`.
   */
  store: Store;
  /**
   * Text measurement for `text` and `note` shapes. Required: hit-testing,
   * erasing and selecting those shapes depend on their measured bounds.
   */
  measureTextWidth: MeasureTextWidth;
  /**
   * Initial camera, QuickDraw's `{ x, y, z }`: `page = view / z - (x, y)`.
   * @default { x: 0, y: 0, z: 1 }
   */
  camera?: Camera;
  /**
   * Initial pen styles, merged over QuickDraw's defaults
   * `{ color: 'black', size: 'm', dash: 'draw', fill: 'none', font: 'draw' }`.
   */
  styles?: Partial<Styles>;
  /**
   * Initial geo kind for the `geo` tool.
   * @default 'rectangle'
   */
  geoKind?: GeoId;
}
