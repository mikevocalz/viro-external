/**
 * Panel layout shared by the native components and the Specs mapper, so a
 * panel places its content the same way on every host. Units are meters,
 * origin at the panel's centre, +y up.
 */

/** Header band at the top of a titled panel. */
export const PANEL_HEADER_HEIGHT = 0.14;
/** Inset between the panel edge and its content. */
export const PANEL_PADDING = 0.04;
/** Space between stacked items. */
export const PANEL_GAP = 0.03;
/**
 * Strip on the right of a scrolling panel body for the scrollbar. 5 cm keeps
 * the up/down buttons near Meta's 48 mm minimum ray target.
 */
export const SCROLLBAR_STRIP = 0.05;

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
  const offsets = headerTextOffsets();
  return { titleY: centerY + offsets.titleY, subtitleY: centerY + offsets.subtitleY };
}

/** Title and subtitle centres relative to the header band's centre. */
export function headerTextOffsets(): { titleY: number; subtitleY: number } {
  const half = PANEL_HEADER_HEIGHT / 2;
  const inset = 0.01;
  return {
    titleY: half - inset - PANEL_TYPE.title.lineHeight / 2,
    subtitleY: -half + inset + PANEL_TYPE.caption.lineHeight / 2,
  };
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

/** Distance panels are designed to be read from (Meta: primary UI at 1.0-2.0 m). */
export const PANEL_VIEW_DISTANCE = 1.5;

/** Height in meters that subtends `degrees` of view at `distance`. */
export function arcHeight(degrees: number, distance = PANEL_VIEW_DISTANCE): number {
  return 2 * distance * Math.tan((degrees * Math.PI) / 360);
}

/**
 * Glyph size from visual angle. ScaledViroText draws 1 mm per point, so the
 * font size in points is the em height in millimeters.
 */
function typeSize(degrees: number) {
  const em = arcHeight(degrees);
  const lineHeight = Math.round(em * 1300) / 1000;
  return {
    fontSize: Math.round(em * 1000),
    lineHeight,
    // Specs label scale tracks line height at the ratio the Lens runtime used.
    specsScale: Math.round(lineHeight * 65 * 100) / 100,
  };
}

/**
 * Text sizes by visual angle, from Meta's VR readability guidance: nothing
 * under 1 degree, body text about 1.5 degrees (4 cm character height at 1.5 m).
 */
export const PANEL_TYPE = {
  title: typeSize(2.2),
  heading: typeSize(2),
  figure: typeSize(2.5),
  label: typeSize(1.5),
  body: typeSize(1.5),
  caption: typeSize(1),
} as const;

export type PanelTextVariant = keyof typeof PANEL_TYPE;

/**
 * Height a wrapped paragraph takes.
 * ponytail: estimated with a 0.6 em average glyph width, wider than the
 * default font's, so the box is never shorter than the wrapped text.
 * ScaledViroText clips to its box either way.
 */
export function paragraphHeight(
  text: string,
  width: number,
  variant: PanelTextVariant = "body"
): number {
  const glyph = (PANEL_TYPE[variant].fontSize / 1000) * 0.6;
  const charsPerLine = Math.max(8, Math.floor(width / glyph));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  return lines * PANEL_TYPE[variant].lineHeight;
}
