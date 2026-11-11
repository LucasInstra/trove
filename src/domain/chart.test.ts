import { describe, expect, it } from "vitest";
import { areaPath, cumulative, linePath, niceMax } from "./chart";

describe("cumulative", () => {
  it("accumulates day by day", () => {
    expect(cumulative([100, -40, 0, 60])).toEqual([100, 60, 60, 120]);
    expect(cumulative([])).toEqual([]);
  });
});

describe("niceMax", () => {
  it("rounds up to friendly steps", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(2390)).toBe(2500);
    expect(niceMax(9000)).toBe(10000);
  });
});

describe("linePath", () => {
  it("maps values onto the box", () => {
    expect(linePath([0, 10], 100, 20, 0)).toBe("M0,20 L100,0");
  });

  it("draws a flat line at its own level", () => {
    expect(linePath([5, 5], 100, 20, 0)).toBe("M0,0 L100,0");
    expect(linePath([0, 0], 100, 20, 0)).toBe("M0,20 L100,20");
  });

  it("returns empty for empty input", () => {
    expect(linePath([], 100, 20)).toBe("");
    expect(areaPath([], 100, 20)).toBe("");
  });
});

describe("areaPath", () => {
  it("closes the line along the bottom", () => {
    expect(areaPath([0, 10], 100, 20, 0)).toBe("M0,20 L100,0 L100,20 L0,20 Z");
  });
});
