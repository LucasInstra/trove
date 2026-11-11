/**
 * SVG paths from plain numbers: the only chart math in the app. Everything
 * is integer-safe (cents in, rounded pixels out) and every function is pure,
 * so the same input always draws the same line.
 */

/** Running total: day N holds everything up to and including N. */
export function cumulative(values: number[]): number[] {
  let running = 0;
  return values.map((value) => {
    running += value;
    return running;
  });
}

/** The last `count` values, in order. Short input comes back whole. */
export function trailing(values: number[], count: number): number[] {
  return values.slice(Math.max(0, values.length - Math.max(0, count)));
}

/** Round up to a 1/2/2.5/5 step so axes never end mid-bar. Zero stays one. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

function scaled(values: number[], width: number, height: number, pad: number): Array<[number, number]> {
  const top = niceMax(Math.max(...values, 0));
  const span = width - pad * 2;
  const rise = height - pad * 2;
  if (values.length === 1) return [[pad, top > 0 ? height - pad - (values[0] / top) * rise : height - pad]];
  return values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * span;
    const y = height - pad - (value / top) * rise;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
}

/** Scaled coordinates, left to right. Empty in, empty out. */
export function pointsOf(
  values: number[],
  width: number,
  height: number,
  pad = 4,
): Array<[number, number]> {
  if (values.length === 0) return [];
  return scaled(values, width, height, pad);
}

/** An SVG polyline through the values, left to right. Empty in, empty out. */
export function linePath(values: number[], width: number, height: number, pad = 4): string {
  return pointsOf(values, width, height, pad)
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
}

/** The same line, closed along the bottom so it fills. */
export function areaPath(values: number[], width: number, height: number, pad = 4): string {
  if (values.length === 0) return "";
  const line = linePath(values, width, height, pad);
  return `${line} L${width - pad},${height - pad} L${pad},${height - pad} Z`;
}
