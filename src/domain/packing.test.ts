import { describe, expect, it } from "vitest";
import { rowSpanFor, spanHeight } from "./packing";

const UNIT = 4;
const GAP = 14;

describe("rowSpanFor", () => {
  it("leaves at least the gap free under the card", () => {
    for (const height of [1, 40, 56, 120, 300, 733]) {
      const span = rowSpanFor(height, UNIT, GAP);
      expect(span).toBeGreaterThanOrEqual(1);
      expect(spanHeight(span, UNIT)).toBeGreaterThanOrEqual(height + GAP);
    }
  });

  it("does not waste more than one row unit", () => {
    for (const height of [40, 120, 300, 733]) {
      const span = rowSpanFor(height, UNIT, GAP);
      expect(spanHeight(span, UNIT) - height - GAP).toBeLessThan(UNIT);
    }
  });

  it("keeps the gap between stacked cards between the gap and the gap plus one unit", () => {
    // The space under a card is the span minus its height: it has to stay in a
    // narrow band, otherwise the rows look unevenly spaced.
    for (const height of [60, 215, 188, 152, 162]) {
      const slack = spanHeight(rowSpanFor(height, UNIT, GAP), UNIT) - height;
      expect(slack).toBeGreaterThanOrEqual(GAP);
      expect(slack).toBeLessThan(GAP + UNIT);
    }
  });

  it("is monotonic", () => {
    let previous = 0;
    for (const height of [10, 60, 61, 120, 400]) {
      const span = rowSpanFor(height, UNIT, GAP);
      expect(span).toBeGreaterThanOrEqual(previous);
      previous = span;
    }
  });

  it("falls back to a single row on nonsense", () => {
    expect(rowSpanFor(0, UNIT, GAP)).toBe(1);
    expect(rowSpanFor(-10, UNIT, GAP)).toBe(1);
    expect(rowSpanFor(Number.NaN, UNIT, GAP)).toBe(1);
    expect(rowSpanFor(100, 0, GAP)).toBe(1);
  });
});

describe("spanHeight", () => {
  it("is the unit times the span, and never collapses", () => {
    expect(spanHeight(3, UNIT)).toBe(12);
    expect(spanHeight(1, GAP)).toBe(GAP);
    expect(spanHeight(0, UNIT)).toBe(UNIT);
    expect(spanHeight(2.4, UNIT)).toBe(2 * UNIT);
  });
});
