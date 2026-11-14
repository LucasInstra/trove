import { freeToSpend, paceOf } from "./budgets";
import type { RecurringCharge } from "./recurrence";
import type { BudgetStatus, CategoryTotal, MonthTotals } from "../lib/api";

interface ReportCategory {
  name: string;
  totalCents: number;
  effectiveCents: number | null;
  pace: "ok" | "watch" | "over" | null;
}

export interface MonthlyReport {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  savingsRatePct: number | null;
  top: ReportCategory[];
  over: string[];
  freeCents: number | null;
  globalEffectiveCents: number | null;
  recurring: RecurringCharge[];
}

export interface ReportInput {
  month: string;
  todayYmd: string;
  totals: MonthTotals;
  byCategory: CategoryTotal[];
  status: BudgetStatus | null;
  recurring: RecurringCharge[];
}

/**
 * The month in one page: totals, savings rate, top spending, caps that
 * broke, what is still free and which subscriptions knock next. Pure data —
 * the screen renders it and flattens it to clipboard text.
 */
export function buildMonthlyReport(input: ReportInput): MonthlyReport {
  const { month, todayYmd, totals, byCategory, status, recurring } = input;
  const lines = new Map((status?.lines ?? []).map((line) => [line.categoryId, line]));
  const top = [...byCategory]
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5)
    .map((item) => {
      const line = item.categoryId != null ? lines.get(item.categoryId) : undefined;
      const effective = line?.effectiveCents ?? item.budgetCents ?? null;
      const pace =
        line != null ? paceOf(line.spentCents, line.effectiveCents, todayYmd, month).status : null;
      return { name: item.name, totalCents: item.totalCents, effectiveCents: effective, pace };
    });
  const over = top.filter((item) => item.pace === "over").map((item) => item.name);
  const globalEffective = status?.global?.effectiveCents ?? null;
  return {
    month,
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    balanceCents: totals.incomeCents - totals.expenseCents,
    savingsRatePct:
      totals.incomeCents > 0
        ? Math.round(((totals.incomeCents - totals.expenseCents) / totals.incomeCents) * 100)
        : null,
    top,
    over,
    freeCents: freeToSpend(totals.expenseCents, globalEffective),
    globalEffectiveCents: globalEffective,
    recurring: recurring.filter((charge) => charge.status !== "scheduled"),
  };
}
