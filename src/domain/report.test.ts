import { describe, expect, it } from "vitest";
import { buildMonthlyReport } from "./report";
import type { BudgetStatus, CategoryTotal, MonthTotals } from "../lib/api";

const totals: MonthTotals = {
  month: "2024-03",
  incomeCents: 10000,
  expenseCents: 6000,
  transactionCount: 4,
};

const byCategory: CategoryTotal[] = [
  { categoryId: 1, name: "Comida", color: "#000", totalCents: 5000, budgetCents: 4000 },
  { categoryId: 2, name: "Casa", color: "#111", totalCents: 1000, budgetCents: 5000 },
];

const status: BudgetStatus = {
  month: "2024-03",
  global: {
    categoryId: null,
    name: "",
    color: "#888",
    limitCents: 8000,
    overridden: false,
    carryover: false,
    carryInCents: 0,
    effectiveCents: 8000,
    spentCents: 6000,
  },
  lines: [
    {
      categoryId: 1,
      name: "Comida",
      color: "#000",
      limitCents: 4000,
      overridden: false,
      carryover: false,
      carryInCents: 0,
      effectiveCents: 4000,
      spentCents: 5000,
    },
    {
      categoryId: 2,
      name: "Casa",
      color: "#111",
      limitCents: 5000,
      overridden: false,
      carryover: false,
      carryInCents: 0,
      effectiveCents: 5000,
      spentCents: 1000,
    },
  ],
};

describe("buildMonthlyReport", () => {
  it("packs totals, savings rate, top spending and broken caps", () => {
    const report = buildMonthlyReport({
      month: "2024-03",
      todayYmd: "2024-03-20",
      totals,
      byCategory,
      status,
      recurring: [],
    });
    expect(report.balanceCents).toBe(4000);
    expect(report.savingsRatePct).toBe(40);
    expect(report.top.map((item) => item.name)).toEqual(["Comida", "Casa"]);
    expect(report.over).toEqual(["Comida"]);
    expect(report.freeCents).toBe(2000);
    expect(report.top[0].pace).toBe("over");
    expect(report.top[1].pace).toBe("ok");
  });

  it("stays null-safe without income, caps or charges", () => {
    const report = buildMonthlyReport({
      month: "2024-03",
      todayYmd: "2024-03-20",
      totals: { ...totals, incomeCents: 0, expenseCents: 0 },
      byCategory: [],
      status: null,
      recurring: [],
    });
    expect(report.savingsRatePct).toBe(null);
    expect(report.freeCents).toBe(null);
    expect(report.top).toEqual([]);
    expect(report.over).toEqual([]);
  });
});
