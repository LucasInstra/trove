import type { CategoryTotal } from "../lib/api";
import type { MonthPlan } from "./projection";

export type HealthStatus = "ok" | "warn" | "bad";

export interface HealthSignal {
  id: "bills" | "margin" | "reserve" | "housing" | "budgets";
  status: HealthStatus;
  /** Share 0-1 of the way to good, for the bar. */
  share: number;
}

const STEPS: Record<HealthStatus, number> = { ok: 1, warn: 0.5, bad: 0.15 };

function signal(id: HealthSignal["id"], status: HealthStatus): HealthSignal {
  return { id, status, share: STEPS[status] };
}

/** Months of spending kept in reserve goals. */
export function reserveMonths(plan: MonthPlan): number {
  const reserved = plan.goals
    .filter((entry) => entry.goal.kind === "reserve")
    .reduce((sum, entry) => sum + entry.paidCents, 0);
  const committed = Math.max(1, plan.incomeCents - plan.forecastCents);
  return Math.round((reserved / committed) * 10) / 10;
}

/**
 * Five checks that read like a doctor's note. Every rule derives from the
 * month plan and the category budgets, so the screen never disagrees with
 * the cards. Thresholds live here, next to the score rules.
 */
export function healthSignals(plan: MonthPlan, byCategory: CategoryTotal[]): HealthSignal[] {
  const due = plan.dueBills.length;
  const paidRatio = due === 0 ? 1 : plan.paidBillIds.length / due;

  const marginRatio =
    plan.incomeCents > 0
      ? plan.forecastCents / plan.incomeCents
      : plan.forecastCents >= 0
        ? 0.1
        : -1;

  const months = reserveMonths(plan);

  const over = byCategory.filter(
    (item) => item.budgetCents != null && item.totalCents > item.budgetCents,
  ).length;

  const housingOk = plan.housingCents === 0 || !plan.overCeiling;

  return [
    signal("bills", paidRatio >= 1 ? "ok" : paidRatio >= 0.5 ? "warn" : "bad"),
    signal("margin", marginRatio >= 0.2 ? "ok" : marginRatio >= 0 ? "warn" : "bad"),
    signal("reserve", months >= 3 ? "ok" : months >= 1 ? "warn" : "bad"),
    signal(
      "housing",
      housingOk ? "ok" : plan.housingRatioPct <= plan.ceilingPct + 10 ? "warn" : "bad",
    ),
    signal("budgets", over === 0 ? "ok" : over === 1 ? "warn" : "bad"),
  ];
}
