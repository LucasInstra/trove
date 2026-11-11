import { describe, expect, it } from "vitest";
import type { MonthPoint } from "../lib/api";
import type { MonthPlan } from "./projection";
import { computeKpis } from "./kpis";

function plan(overrides: Partial<MonthPlan>): MonthPlan {
  return {
    month: "2026-11",
    incomeCents: 5_000_00,
    primaryIncomeCents: 5_000_00,
    plannedCents: 0,
    paidCents: 0,
    realizedCents: 0,
    forecastCents: 0,
    overCents: 0,
    hasPlan: false,
    dueBills: [],
    paidBillIds: [],
    pendingBillIds: [],
    dayGroups: [],
    composition: [],
    housingCents: 0,
    housingBills: [],
    housingRatioPct: 0,
    housingRatioPrimaryPct: 0,
    ceilingPct: 30,
    overCeiling: false,
    goals: [],
    ...overrides,
  };
}

const point = (month: string, incomeCents: number, expenseCents: number): MonthPoint => ({
  month,
  incomeCents,
  expenseCents,
});

describe("computeKpis", () => {
  it("compares the month against the previous point in the series", () => {
    const series = [point("2026-10", 5_000_00, 3_000_00), point("2026-11", 5_200_00, 3_100_00)];
    const kpis = computeKpis(
      plan({ month: "2026-11", incomeCents: 5_000_00, hasPlan: true, plannedCents: 3_200_00, forecastCents: 1_800_00 }),
      series,
      "2026-11",
    );
    expect(kpis.prevMonth).toBe("2026-10");
    expect(kpis.income).toEqual({ valueCents: 5_000_00, prevCents: 5_000_00, deltaPct: 0 });
    expect(kpis.expense.valueCents).toBe(3_200_00);
    expect(kpis.expense.deltaPct).toBeCloseTo(6.7, 1);
    expect(kpis.balance.valueCents).toBe(1_800_00);
    expect(kpis.balance.deltaPct).toBeCloseTo(-10, 1);
  });

  it("uses realized spending when the month has no planned bills", () => {
    const series = [point("2026-10", 5_000_00, 3_000_00), point("2026-11", 5_000_00, 3_000_00)];
    const kpis = computeKpis(
      plan({ month: "2026-11", realizedCents: 2_500_00, forecastCents: 2_500_00 }),
      series,
      "2026-11",
    );
    expect(kpis.expense.valueCents).toBe(2_500_00);
    expect(kpis.expense.deltaPct).toBeCloseTo(-16.7, 1);
  });

  it("reports no previous month for the first point in the series", () => {
    const series = [point("2026-11", 5_000_00, 3_000_00)];
    const kpis = computeKpis(plan({ month: "2026-11", forecastCents: 2_000_00 }), series, "2026-11");
    expect(kpis.prevMonth).toBeNull();
    expect(kpis.income.deltaPct).toBeNull();
    expect(kpis.balance.prevCents).toBeNull();
  });

  it("reports no delta when the previous month is zero", () => {
    const series = [point("2026-10", 0, 0), point("2026-11", 5_000_00, 3_000_00)];
    const kpis = computeKpis(plan({ month: "2026-11", forecastCents: 2_000_00 }), series, "2026-11");
    expect(kpis.income.deltaPct).toBeNull();
    expect(kpis.balance.deltaPct).toBeNull();
  });
});
