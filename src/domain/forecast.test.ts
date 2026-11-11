import { describe, expect, it } from "vitest";
import { averageOf, projectCash } from "./forecast";

describe("projectCash", () => {
  it("repeats the monthly delta on the starting balance", () => {
    const points = projectCash("2024-03", 10000, 5000, 3000, 3);
    expect(points.map((point) => point.month)).toEqual(["2024-04", "2024-05", "2024-06"]);
    expect(points.map((point) => point.balanceCents)).toEqual([12000, 14000, 16000]);
  });

  it("rolls over the year and clamps the horizon", () => {
    const points = projectCash("2024-12", 0, 1000, 1500, 2);
    expect(points.map((point) => point.month)).toEqual(["2025-01", "2025-02"]);
    expect(points[1].balanceCents).toBe(-1000);
    expect(projectCash("2024-12", 0, 1000, 1000, 0)).toEqual([]);
    expect(projectCash("2024-12", 0, 1000, 1000, 99)).toHaveLength(12);
  });
});

describe("averageOf", () => {
  it("means and rounds, zero when empty", () => {
    expect(averageOf([100, 201])).toBe(151);
    expect(averageOf([])).toBe(0);
  });
});
