import { describe, expect, it } from "vitest";
import type { MonthPoint } from "../lib/api";
import { holdingsByKind, holdingsTotal, netWorthCurve, totalWealth } from "./patrimony";

const point = (month: string, incomeCents: number, expenseCents: number): MonthPoint => ({
  month,
  incomeCents,
  expenseCents,
});

describe("netWorthCurve", () => {
  it("accumulates the monthly net from zero", () => {
    const curve = netWorthCurve([
      point("2026-09", 5_000_00, 3_000_00),
      point("2026-10", 5_000_00, 6_000_00),
      point("2026-11", 5_000_00, 3_000_00),
    ]);
    expect(curve.map((entry) => entry.netCents)).toEqual([2_000_00, -1_000_00, 2_000_00]);
    expect(curve.map((entry) => entry.runningCents)).toEqual([2_000_00, 1_000_00, 3_000_00]);
  });

  it("stays empty without history", () => {
    expect(netWorthCurve([])).toEqual([]);
  });
});

describe("holdings", () => {
  it("adds up and groups by kind, biggest first", () => {
    const holdings = [
      { kind: "cash", amountCents: 1000 },
      { kind: "investment", amountCents: 5000 },
      { kind: "cash", amountCents: 2000 },
    ];
    expect(holdingsTotal(holdings)).toBe(8000);
    expect(holdingsByKind(holdings)).toEqual([
      { kind: "investment", totalCents: 5000 },
      { kind: "cash", totalCents: 3000 },
    ]);
    expect(holdingsTotal([])).toBe(0);
  });

  it("joins reserves, accumulation and holdings into one total", () => {
    expect(totalWealth(2000, 3000, 8000)).toBe(13000);
  });
});
