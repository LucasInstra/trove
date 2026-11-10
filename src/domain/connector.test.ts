import { describe, expect, it } from "vitest";
import { connectorPath, connectorPoints, dotLevels } from "./connector";

describe("dotLevels", () => {
  it("scales to the biggest value", () => {
    expect(dotLevels([100, 200, 50])).toEqual([0.5, 1, 0.25]);
  });

  it("collapses when nothing was spent", () => {
    expect(dotLevels([0, 0, 0])).toEqual([0, 0, 0]);
    expect(dotLevels([])).toEqual([]);
  });

  it("treats a negative or broken value as zero", () => {
    expect(dotLevels([-10, Number.NaN, 100])).toEqual([0, 0, 1]);
  });
});

describe("connectorPoints", () => {
  it("centres one point in each slice of the row", () => {
    const points = connectorPoints([1, 1, 1], 300, 10, 40);
    expect(points.map((point) => point.x)).toEqual([50, 150, 250]);
    expect(points.every((point) => point.y === 10)).toBe(true);
  });

  it("puts a bigger value higher and a zero at the bottom", () => {
    const [small, big] = connectorPoints([0, 1], 200, 0, 40);
    expect(small.y).toBe(40);
    expect(big.y).toBe(0);
  });
});

describe("connectorPath", () => {
  it("starts with a move and then lines", () => {
    const path = connectorPath([
      { x: 50, y: 40 },
      { x: 150, y: 10 },
    ]);
    expect(path).toBe("M50 40 L150 10");
  });

  it("is empty without points", () => {
    expect(connectorPath([])).toBe("");
  });
});
