/**
 * Geometry of the dotted line that joins the upcoming invoice cards.
 *
 * The dots sit at a height proportional to the invoice, so a month that spent
 * more shows its dot higher. Everything here is pure and in pixels; the caller
 * measures the row and passes the width.
 */

export interface ConnectorPoint {
  x: number;
  y: number;
}

/** 0 for the smallest value, 1 for the biggest. All zeros collapse to 0. */
export function dotLevels(values: number[]): number[] {
  if (values.length === 0) return [];
  const clean = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...clean);
  if (max <= 0) return clean.map(() => 0);
  return clean.map((value) => value / max);
}

/**
 * One point per value, centred in its slice of the row. `top` and `height` are
 * the band the dots may live in, measured from the top of the row.
 */
export function connectorPoints(
  levels: number[],
  width: number,
  top: number,
  height: number,
): ConnectorPoint[] {
  const count = levels.length;
  if (count === 0) return [];
  const step = width / count;
  return levels.map((level, index) => ({
    x: step * (index + 0.5),
    y: top + (1 - Math.min(1, Math.max(0, level))) * height,
  }));
}

/** Dashed path through the points, rounded to a tenth of a pixel. */
export function connectorPath(points: ConnectorPoint[]): string {
  if (points.length === 0) return "";
  const round = (value: number) => Math.round(value * 10) / 10;
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
    .join(" ");
}
