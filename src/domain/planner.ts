import type { GoalProgress } from "./projection";
import type { CardMeta, Income } from "../lib/api";

export interface CardOverviewEntry {
  meta: CardMeta;
  usageCents: number;
  window: { from: string; to: string };
}

export function summarizeCards(cards: CardOverviewEntry[]) {
  return {
    invoiceCents: cards.reduce((sum, card) => sum + card.usageCents, 0),
    limitCents: cards.reduce((sum, card) => sum + card.meta.limitCents, 0),
  };
}

export function cardLimitUsage(meta: CardMeta, usageCents: number) {
  return {
    availableCents: Math.max(0, meta.limitCents - usageCents),
    usedPct:
      meta.limitCents > 0
        ? Math.round(Math.min(100, (usageCents / meta.limitCents) * 100) * 10) / 10
        : 0,
  };
}

export function summarizeGoals(goals: GoalProgress[]) {
  return {
    monthlyCents: goals.reduce((sum, entry) => sum + entry.goal.monthlyCents, 0),
    savedCents: goals.reduce((sum, entry) => sum + entry.paidCents, 0),
  };
}

export function activeIncomeCount(incomes: Income[]) {
  return incomes.filter((income) => income.active).length;
}
