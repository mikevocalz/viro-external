/**
 * Panel layout shared by the native components and the Specs mapper, so a
 * panel places its content the same way on every host. Units are meters,
 * origin at the panel's centre, +y up.
 */

/** Header band at the top of a titled panel. */
export const PANEL_HEADER_HEIGHT = 0.1;
/** Inset between the panel edge and its content. */
export const PANEL_PADDING = 0.04;
/** Space between stacked items. */
export const PANEL_GAP = 0.03;

export type PanelBody = {
  /** Centre of the content area, below the header. */
  centerY: number;
  width: number;
  height: number;
};

/** The area under the header that content and scrolling occupy. */
export function panelBody(
  width: number,
  height: number,
  hasHeader: boolean
): PanelBody {
  const header = hasHeader ? PANEL_HEADER_HEIGHT : 0;
  const bodyHeight = height - header - PANEL_PADDING;
  // Top edge at height/2 - header, bottom edge at -height/2 + padding.
  return {
    centerY: (PANEL_PADDING - header) / 2,
    width: width - PANEL_PADDING * 2,
    height: bodyHeight,
  };
}

/**
 * Whether a SpatialPanel draws a header band. Pin and close default on, so a
 * panel has one unless all four are absent; the mapper uses the same rule so
 * body geometry matches on every host.
 */
export function panelHasHeader(props: {
  title?: string;
  subtitle?: string;
  headerActions?: readonly unknown[];
  showPinAction?: boolean;
  showCloseAction?: boolean;
}): boolean {
  return Boolean(
    props.title ||
      props.subtitle ||
      props.headerActions?.length ||
      (props.showPinAction ?? true) ||
      (props.showCloseAction ?? true)
  );
}

/** Header title and subtitle centres. */
export function panelHeader(height: number): { titleY: number; subtitleY: number } {
  const centerY = height / 2 - PANEL_HEADER_HEIGHT / 2;
  return { titleY: centerY + 0.012, subtitleY: centerY - 0.03 };
}

/**
 * Top-down column: each item's centre y, measured from the top edge of a
 * region whose top is at `top`. Returns the total height used too.
 */
export function stackLayout(
  heights: readonly number[],
  top: number,
  gap = PANEL_GAP
): { centers: number[]; height: number } {
  const centers: number[] = [];
  let cursor = 0;
  heights.forEach((height, index) => {
    if (index > 0) cursor += gap;
    centers.push(top - cursor - height / 2);
    cursor += height;
  });
  return { centers, height: cursor };
}

/** Left-to-right row inside `width`, each item's centre x. */
export function rowLayout(
  widths: readonly number[],
  width: number,
  gap = PANEL_GAP
): number[] {
  const used = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
  let cursor = -Math.min(used, width) / 2;
  return widths.map((w) => {
    const center = cursor + w / 2;
    cursor += w + gap;
    return center;
  });
}

/**
 * Text sizes as multipliers of the Specs runtime's base label, and the
 * matching native font sizes. Line heights are in meters.
 */
export const PANEL_TYPE = {
  title: { specsScale: 3.2, fontSize: 30, lineHeight: 0.045 },
  heading: { specsScale: 2.2, fontSize: 22, lineHeight: 0.035 },
  figure: { specsScale: 3, fontSize: 28, lineHeight: 0.04 },
  label: { specsScale: 1.7, fontSize: 18, lineHeight: 0.026 },
  body: { specsScale: 1.5, fontSize: 16, lineHeight: 0.017 },
  caption: { specsScale: 1.4, fontSize: 14, lineHeight: 0.022 },
} as const;

export type PanelTextVariant = keyof typeof PANEL_TYPE;

/**
 * Height a wrapped paragraph takes.
 * ponytail: estimated from character count (about 95 body characters per
 * 0.82 m line, scaled by width); measure laid-out Text bounds if long
 * paragraphs start overlapping what follows.
 */
export function paragraphHeight(
  text: string,
  width: number,
  variant: PanelTextVariant = "body"
): number {
  const charsPerLine = Math.max(10, Math.floor((95 * width) / 0.82));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  return lines * PANEL_TYPE[variant].lineHeight;
}
