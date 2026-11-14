import { describe, expect, it } from "vitest";
import type { Bill } from "../lib/api";
import type { MonthPlan } from "./projection";
import { computeScore } from "./score";

const bill = (id: number): Bill => ({
  id,
  name: `Bill ${id}`,
  amountCents: 100_00,
  dueDay: 5,
  frequency: "monthly",
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  accountId: null,
  goalId: null,
  startsOn: "2026-01-01",
  endsOn: null,
  installmentsTotal: null,
  active: true,
});

const reserve = (paidCents: number): MonthPlan["goals"][number] => ({
  goal: {
    id: 1,
    name: "Reserva",
    kind: "reserve",
    targetCents: 1_000_000,
    monthlyCents: 100_000,
    startsOn: "2026-01-01",
    accountId: null,
    icon: "target",
    color: "#1f6b4f",
  },
  paidCents,
  sharePct: 0,
});

const plan = (patch: Partial<MonthPlan> = {}): MonthPlan => ({
  month: "2026-11",
  incomeCents: 5_000_00,
  primaryIncomeCents: 5_000_00,
  plannedCents: 3_000_00,
  paidCents: 0,
  realizedCents: 0,
  forecastCents: 2_000_00,
  overCents: 0,
  hasPlan: true,
  dueBills: [bill(1), bill(2)],
  paidBillIds: [1, 2],
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
  ...patch,
});

describe("computeScore", () => {
  it("rewards paid bills, margin and reserve", () => {
    const result = computeScore(plan({ goals: [reserve(18_000_00)] }));
    // 40 on time + 12 margin (40%) + 30 reserve (6 months) = 82.
    expect(result.parts).toEqual({ onTime: 40, margin: 12, reserve: 30 });
    expect(result.total).toBe(82);
    expect(result.reserveMonths).toBe(6);
    expect(result.weakest).toBe("margin");
  });

  it("calls a great month good", () => {
    const result = computeScore(
      plan({ plannedCents: 1_000_00, forecastCents: 4_000_00, goals: [reserve(60_000_00)] }),
    );
    expect(result.total).toBe(94);
    expect(result.weakest).toBeNull();
  });

  it("punishes late bills and overspending", () => {
    const result = computeScore(
      plan({ paidBillIds: [], forecastCents: -500_00, plannedCents: 5_500_00 }),
    );
    expect(result.parts.onTime).toBe(0);
    expect(result.parts.margin).toBe(0);
    expect(result.total).toBe(0);
  });

  it("stays neutral with no data at all", () => {
    const result = computeScore(
      plan({
        incomeCents: 0,
        plannedCents: 0,
        forecastCents: 0,
        dueBills: [],
        paidBillIds: [],
      }),
    );
    expect(result.parts).toEqual({ onTime: 40, margin: 15, reserve: 0 });
    expect(result.weakest).toBe("reserve");
  });
});
