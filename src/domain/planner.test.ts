import { describe, expect, it } from "vitest";
import type { GoalProgress } from "./projection";
import type { CardMeta, Income } from "../lib/api";
import {
  activeIncomeCount,
  cardLimitUsage,
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

  it("answers zeros for an empty list instead of NaN", () => {
    expect(summarizeCards([])).toEqual({ invoiceCents: 0, limitCents: 0 });
    expect(summarizeGoals([])).toEqual({ monthlyCents: 0, savedCents: 0 });
    expect(activeIncomeCount([])).toBe(0);
  });

  it("does not divide by a zero limit and caps a maxed card", () => {
    const noLimit = cardLimitUsage(card(1, 0), 500);
    expect(noLimit).toEqual({ availableCents: 0, usedPct: 0 });

    const over = cardLimitUsage(card(2, 1_000), 1_500);
    expect(over.availableCents).toBe(0);
    expect(over.usedPct).toBe(100);
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
