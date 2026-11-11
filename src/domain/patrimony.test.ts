import { describe, expect, it } from "vitest";
import type { MonthPoint } from "../lib/api";
import { netWorthCurve } from "./patrimony";

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
