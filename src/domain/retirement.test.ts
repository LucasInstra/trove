import { describe, expect, it } from "vitest";
import { retirementProjection } from "./retirement";

describe("retirementProjection", () => {
  it("adds contributions without interest", () => {
    const points = retirementProjection({
      currentCents: 0,
      monthlyCents: 100_000,
      years: 1,
      annualRatePct: 0,
    });
    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({ year: 1, balanceCents: 1_200_000 });
  });

  it("compounds monthly at the annual rate", () => {
    // 1000 a month at 12% a year: 1000 * ((1.01^12 - 1) / 0.01) = 12682.50.
    const points = retirementProjection({
      currentCents: 0,
      monthlyCents: 100_000,
      years: 1,
      annualRatePct: 12,
    });
    expect(points[1].balanceCents).toBe(1_268_250);
  });

  it("grows the starting balance and clamps nonsense", () => {
    const points = retirementProjection({
      currentCents: 500_000,
      monthlyCents: 0,
      years: 2,
      annualRatePct: 0,
    });
    expect(points.map((point) => point.year)).toEqual([0, 1, 2]);
    expect(points[2].balanceCents).toBe(500_000);
    expect(
      retirementProjection({ currentCents: -1, monthlyCents: -5, years: 0, annualRatePct: -3 }),
    ).toEqual([{ year: 0, balanceCents: 0 }]);
  });
});
