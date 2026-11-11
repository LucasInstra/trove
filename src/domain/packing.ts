/**
 * Row units for the dashboard grid.
 *
 * A CSS grid with uniform rows cannot pack cards of very different heights
 * without leaving holes, so the grid uses a very small fixed row and every card
 * declares how many of those rows it needs. The span must also cover the gap
 * that separates it from the next card, because the grid has no row gap of its
 * own: that way the space between two stacked cards stays between `gap` and
 * `gap + unit`, instead of drifting by a whole gap.
 */

export function rowSpanFor(heightPx: number, unitPx: number, gapPx: number): number {
  if (
    !Number.isFinite(heightPx) ||
    heightPx <= 0 ||
    !Number.isFinite(unitPx) ||
    unitPx <= 0 ||
    !Number.isFinite(gapPx) ||
    gapPx < 0
  ) {
    return 1;
  }
  return Math.max(1, Math.ceil((heightPx + gapPx) / unitPx));
}

/** Height the cell will occupy once the span is applied. */
export function spanHeight(span: number, unitPx: number): number {
  const safe = Math.max(1, Math.round(span));
  return safe * unitPx;
}
