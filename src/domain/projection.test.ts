import { describe, expect, it } from "vitest";
import type { Bill, BillPayment, Income } from "../lib/api";
import { buildComposition, isDueIn, planMonth, primaryOf } from "./projection";

const income = (amountCents: number): Income => ({
  id: 1,
  name: "Salário",
  amountCents,
  frequency: "monthly",
  payDay: 5,
  accountId: null,
  active: true,
});

const bill = (id: number, amountCents: number, dueDay: number, patch: Partial<Bill> = {}): Bill => ({
  id,
  name: `Bill ${id}`,
  amountCents,
  dueDay,
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
  ...patch,
});

const payment = (billId: number, amountCents: number): BillPayment => ({
  id: billId * 10,
  billId,
  month: "2026-12",
  paidOn: "2026-12-02",
  amountCents,
});

const base = {
  month: "2026-12",
  goals: [],
  goalTotals: [],
  housingCategoryId: null,
  ceilingPct: 30,
};

describe("planMonth", () => {
  it("reproduces the mockup to the cent and the bar closes at 100%", () => {
    const plan = planMonth({
      ...base,
      incomes: [income(2_800_000)],
      bills: [bill(1, 766_622, 5), bill(2, 1_452_950, 20), bill(3, 50_000, 28)],
      payments: [],
      totals: { month: "2026-12", incomeCents: 2_800_000, expenseCents: 1_900_000, transactionCount: 12 },
    });

    expect(plan.incomeCents).toBe(2_800_000);
    expect(plan.plannedCents).toBe(2_269_572);
    expect(plan.forecastCents).toBe(530_428);
    expect(plan.composition.reduce((total, part) => total + part.amountCents, 0)).toBe(2_800_000);
    expect(plan.composition.reduce((total, part) => total + part.sharePct, 0)).toBeCloseTo(100, 1);
    expect(plan.overCents).toBe(0);
  });

  it("reports an overspent month without going past the track", () => {
    const plan = planMonth({
      ...base,
      incomes: [income(2_800_000)],
      bills: [bill(1, 3_000_000, 5)],
      payments: [],
      totals: null,
    });

    expect(plan.forecastCents).toBe(-200_000);
    expect(plan.overCents).toBe(200_000);
    expect(plan.composition).toHaveLength(1);
    expect(plan.composition[0].sharePct).toBe(100);
  });

  it("falls back to the statement when no income was planned", () => {
    const plan = planMonth({
      ...base,
      incomes: [],
      bills: [],
      payments: [],
      totals: { month: "2026-12", incomeCents: 500_000, expenseCents: 320_000, transactionCount: 4 },
    });

    expect(plan.hasPlan).toBe(false);
    expect(plan.incomeCents).toBe(500_000);
    expect(plan.forecastCents).toBe(180_000);
    expect(plan.composition[0].key).toBe("spent");
  });

  it("counts what was paid and lists what is pending", () => {
    const plan = planMonth({
      ...base,
      incomes: [income(2_800_000)],
      bills: [bill(1, 100_000, 5), bill(2, 200_000, 10), bill(3, 300_000, 15)],
      payments: [payment(1, 100_000), payment(2, 200_000)],
      totals: null,
    });

    expect(plan.paidCents).toBe(300_000);
    expect(plan.paidBillIds).toEqual([1, 2]);
    expect(plan.pendingBillIds).toEqual([3]);
    expect(plan.dayGroups.map((group) => group.day)).toEqual([5, 10, 15]);
  });

  it("measures housing against the income and flags the ceiling", () => {
    const plan = planMonth({
      ...base,
      incomes: [income(2_800_000)],
      bills: [bill(1, 566_622, 5, { categoryId: 9 }), bill(2, 100_000, 6)],
      payments: [],
      totals: null,
      housingCategoryId: 9,
    });

    expect(plan.housingCents).toBe(566_622);
    expect(plan.housingRatioPct).toBeCloseTo(20.2, 1);
    expect(plan.overCeiling).toBe(false);
    // The screen lists the bills behind that number, so the plan carries them.
    expect(plan.housingBills.map((entry) => entry.id)).toEqual([1]);
  });

  it("lists no housing bills when no category is chosen", () => {
    const plan = planMonth({
      ...base,
      incomes: [],
      bills: [bill(1, 566_622, 5, { categoryId: 9 })],
      payments: [],
      totals: null,
      housingCategoryId: null,
    });

    expect(plan.housingBills).toEqual([]);
    expect(plan.housingCents).toBe(0);
  });

  it("ignores a bill outside its life and an inactive one", () => {
    const plan = planMonth({
      ...base,
      incomes: [income(1_000_000)],
      bills: [
        bill(1, 100_000, 5, { startsOn: "2027-01-01" }),
        bill(2, 200_000, 5, { active: false }),
        bill(3, 300_000, 5, { endsOn: "2026-11-30" }),
        bill(4, 50_000, 5),
      ],
      payments: [],
      totals: null,
    });

    expect(plan.dueBills.map((entry) => entry.id)).toEqual([4]);
    expect(plan.plannedCents).toBe(50_000);
  });
});

describe("isDueIn", () => {
  it("keeps a one-off bill in its own month", () => {
    const once = bill(1, 1000, 5, { frequency: "once", startsOn: "2026-07-01" });
    expect(isDueIn(once, "2026-07")).toBe(true);
    expect(isDueIn(once, "2026-08")).toBe(false);
  });

  it("ends an installment purchase after its last parcel", () => {
    const purchase = bill(1, 250_00, 20, { startsOn: "2026-03-01", installmentsTotal: 24 });
    expect(isDueIn(purchase, "2026-02")).toBe(false);
    expect(isDueIn(purchase, "2026-03")).toBe(true);
    expect(isDueIn(purchase, "2028-02")).toBe(true);
    expect(isDueIn(purchase, "2028-03")).toBe(false);
  });

  it("lets an explicit end shorten the installment run", () => {
    const purchase = bill(1, 250_00, 20, {
      startsOn: "2026-03-01",
      endsOn: "2026-05-31",
      installmentsTotal: 24,
    });
    expect(isDueIn(purchase, "2026-05")).toBe(true);
    expect(isDueIn(purchase, "2026-06")).toBe(false);
  });
});

describe("buildComposition", () => {
  it("stays empty without money on either side", () => {
    expect(buildComposition(0, 0, 0, false)).toEqual([]);
  });
});

describe("housing income scope", () => {
  it("separates my income from every income in the house", () => {
    const plan = planMonth({
      ...base,
      incomes: [income(3_000_000), { ...income(1_000_000), id: 2, name: "Aluguel recebido" }],
      bills: [bill(1, 566_622, 5, { categoryId: 9 })],
      payments: [],
      totals: null,
      housingCategoryId: 9,
    });

    expect(plan.incomeCents).toBe(4_000_000);
    expect(plan.primaryIncomeCents).toBe(3_000_000);
    expect(plan.housingRatioPct).toBeCloseTo(14.2, 1);
    expect(plan.housingRatioPrimaryPct).toBeCloseTo(18.9, 1);
  });

  it("picks the biggest active monthly income as mine", () => {
    expect(primaryOf([income(100_000), { ...income(900_000), id: 2 }])).toBe(900_000);
    expect(primaryOf([{ ...income(900_000), active: false }])).toBe(0);
    expect(primaryOf([])).toBe(0);
  });
});
