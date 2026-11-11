import { describe, expect, it } from "vitest";
import type { Bill, CategoryTotal } from "../lib/api";
import type { MonthPlan } from "./projection";
import { healthSignals } from "./health";

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
    color: "#1f6b4f",
  },
  paidCents,
  sharePct: 0,
});

const category = (patch: Partial<CategoryTotal>): CategoryTotal => ({
  categoryId: 1,
  name: "Food",
  color: "#d98c3f",
  totalCents: 100_00,
  budgetCents: null,
  ...patch,
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

const statusOf = (plan: MonthPlan, byCategory: CategoryTotal[] = []) =>
  Object.fromEntries(healthSignals(plan, byCategory).map((signal) => [signal.id, signal.status]));

describe("healthSignals", () => {
  it("calls a tidy month good everywhere", () => {
    expect(
      statusOf(plan({ goals: [reserve(9_000_00)] }), [category({}), category({ categoryId: 2, totalCents: 50_00, budgetCents: 100_00 })]),
    ).toEqual({ bills: "ok", margin: "ok", reserve: "ok", housing: "ok", budgets: "ok" });
  });

  it("flags late bills, thin margin, no reserve and blown budgets", () => {
    expect(
      statusOf(
        plan({ paidBillIds: [], forecastCents: -500_00 }),
        [category({ totalCents: 150_00, budgetCents: 100_00 }), category({ categoryId: 2, totalCents: 60_00, budgetCents: 50_00 })],
      ),
    ).toEqual({ bills: "bad", margin: "bad", reserve: "bad", housing: "ok", budgets: "bad" });
  });

  it("warns in the middle ground", () => {
    expect(
      statusOf(plan({ paidBillIds: [1], goals: [reserve(3_000_00)] }), [category({ totalCents: 150_00, budgetCents: 100_00 })]),
    ).toEqual({ bills: "warn", margin: "ok", reserve: "warn", housing: "ok", budgets: "warn" });
  });

  it("flags housing past the ceiling", () => {
    expect(
      statusOf(plan({ housingCents: 2_000_00, housingRatioPct: 40, overCeiling: true })).housing,
    ).toBe("warn");
    expect(
      statusOf(plan({ housingCents: 2_500_00, housingRatioPct: 50, overCeiling: true })).housing,
    ).toBe("bad");
  });
});
