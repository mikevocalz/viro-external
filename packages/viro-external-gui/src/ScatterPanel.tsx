import React, { useMemo } from "react";
import defaults from "../config/defaults.json";
import { VolumeBasedPanel, type VolumeMapper, type VolumeBasedPanelProps } from "./VolumeBasedPanel";
import type { Vec3 } from "react-native-viro-mux";

export interface ScatterPanelProps extends Omit<VolumeBasedPanelProps, "map" | "columns" | "rows" | "margin"> {
  columns?: number;
  rows?: number;
  margin?: number;
  /** Number of relaxation passes for de-overlap. Babylon default 100. */
  iteration?: number;
  /** Deterministic seed. */
  seed?: number;
  /** Per-cell width/height (used as minimum separation). */
  cellWidth?: number;
  cellHeight?: number;
  /** Scatter area in meters. */
  areaWidth?: number;
  areaHeight?: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterAndRelax(opts: {
  count: number;
  iteration: number;
  seed: number;
  minSep: number;
  areaWidth: number;
  areaHeight: number;
}): [number, number][] {
  const { count, iteration, seed, minSep, areaWidth, areaHeight } = opts;
  const rand = mulberry32(seed);
  const pts: [number, number][] = new Array(count);
  for (let i = 0; i < count; i++) {
    pts[i] = [(rand() - 0.5) * areaWidth, (rand() - 0.5) * areaHeight];
  }
  const minSep2 = minSep * minSep;
  for (let pass = 0; pass < iteration; pass++) {
    let moved = false;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pts[j]![0] - pts[i]![0];
        const dy = pts[j]![1] - pts[i]![1];
        const d2 = dx * dx + dy * dy;
        if (d2 < minSep2 && d2 > 0) {
          const d = Math.sqrt(d2);
          const push = (minSep - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          pts[i] = [pts[i]![0] - ux * push, pts[i]![1] - uy * push];
          pts[j] = [pts[j]![0] + ux * push, pts[j]![1] + uy * push];
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return pts;
}

export function ScatterPanel(props: ScatterPanelProps): React.ReactElement {
  const {
    columns = defaults.cylinderPanel.columns,
    rows = defaults.cylinderPanel.rows,
    margin = defaults.cylinderPanel.margin,
    iteration = 100,
    seed = 1,
    cellWidth = defaults.button.widthMeters,
    cellHeight = defaults.button.heightMeters,
    areaWidth = 1.6,
    areaHeight = 0.9,
    children,
    ...rest
  } = props;

  const count = React.Children.count(children);
  const minSep = Math.max(cellWidth, cellHeight) + margin;
  const points = useMemo(
    () => scatterAndRelax({ count, iteration, seed, minSep, areaWidth, areaHeight }),
    [count, iteration, seed, minSep, areaWidth, areaHeight]
  );

  const map: VolumeMapper = useMemo(() => {
    return ({ index }) => {
      const p = points[index] ?? [0, 0];
      return { position: [p[0], p[1], 0] as Vec3 };
    };
  }, [points]);

  return (
    <VolumeBasedPanel
      {...rest}
      columns={columns}
      rows={rows}
      margin={margin}
      map={map}
    >
      {children}
    </VolumeBasedPanel>
  );
}

// Self-check: deterministic given seed.
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const a = scatterAndRelax({ count: 8, iteration: 50, seed: 42, minSep: 0.2, areaWidth: 1.6, areaHeight: 0.9 });
  const b = scatterAndRelax({ count: 8, iteration: 50, seed: 42, minSep: 0.2, areaWidth: 1.6, areaHeight: 0.9 });
  console.assert(a.length === b.length, "scatter deterministic count");
  console.assert(a.every((p, i) => p[0] === b[i]![0] && p[1] === b[i]![1]), "scatter deterministic positions");
}
