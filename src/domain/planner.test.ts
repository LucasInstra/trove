import { describe, expect, it } from "vitest";
import type { GoalProgress } from "./projection";
import type { Bill, CardMeta, Income } from "../lib/api";
import {
  activeIncomeCount,
  cardLimitUsage,
  housingBillsForCategory,
  summarizeCards,
  summarizeGoals,
} from "./planner";

const card = (id: number, limitCents: number): CardMeta => ({
  id,
  accountId: id,
  accountName: `Account ${id}`,
  brand: "",
  last4: "1234",
  limitCents,
  closingDay: 5,
  dueDay: 12,
  color: "var(--primary)",
  texture: "plain",
});

const bill = (id: number, categoryId: number | null): Bill => ({
  id,
  name: `Bill ${id}`,
  amountCents: 10000,
  dueDay: 5,
  frequency: "monthly",
  categoryId,
  categoryName: null,
  categoryColor: null,
  accountId: null,
  goalId: null,
  startsOn: "2026-01-01",
  endsOn: null,
  active: true,
});

describe("planner summaries", () => {
  it("keeps card invoices and limits in integer cents", () => {
    const cards = [
      {
        meta: card(1, 100000),
        usageCents: 24000,
        window: { from: "2026-11-01", to: "2026-11-30" },
      },
      { meta: card(2, 50000), usageCents: 12000, window: { from: "2026-11-01", to: "2026-11-30" } },
    ];
    expect(summarizeCards(cards)).toEqual({ invoiceCents: 36000, limitCents: 150000 });
    expect(cardLimitUsage(cards[0].meta, cards[0].usageCents)).toEqual({
      availableCents: 76000,
      usedPct: 24,
    });
  });

  it("summarizes goal contributions without converting cents", () => {
    const goals: GoalProgress[] = [
      {
        goal: {
          id: 1,
          name: "Trip",
          kind: "reserve",
          targetCents: 90000,
          monthlyCents: 10000,
          startsOn: "2026-01-01",
          accountId: null,
          color: "var(--primary)",
        },
        paidCents: 20000,
        sharePct: 22.2,
      },
      {
        goal: {
          id: 2,
          name: "Buffer",
          kind: "reserve",
          targetCents: 150000,
          monthlyCents: 5000,
          startsOn: "2026-01-01",
          accountId: null,
          color: "var(--positive)",
        },
        paidCents: 40000,
        sharePct: 26.7,
      },
    ];
    expect(summarizeGoals(goals)).toEqual({ monthlyCents: 15000, savedCents: 60000 });
  });

  it("selects only bills in the housing category", () => {
    const bills = [bill(1, 7), bill(2, 8), bill(3, null)];
    expect(housingBillsForCategory(bills, 7).map((entry) => entry.id)).toEqual([1]);
    expect(housingBillsForCategory(bills, null)).toEqual([]);
  });

  it("counts active income sources", () => {
    const incomes: Income[] = [
      {
        id: 1,
        name: "Pay",
        amountCents: 100,
        frequency: "monthly",
        payDay: 5,
        accountId: null,
        active: true,
      },
      {
        id: 2,
        name: "Old",
        amountCents: 100,
        frequency: "monthly",
        payDay: 5,
        accountId: null,
        active: false,
      },
    ];
    expect(activeIncomeCount(incomes)).toBe(1);
  });
});
