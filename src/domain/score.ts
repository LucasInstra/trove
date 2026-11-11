import type { MonthPlan } from "./projection";

export interface ScoreBreakdown {
  /** Paying on time, 0-40. */
  onTime: number;
  /** Keeping a margin, 0-30. */
  margin: number;
  /** Months of spending saved, 0-30. */
  reserve: number;
}

export interface Score {
  total: number;
  parts: ScoreBreakdown;
  /** Reserve measured in months of spending. */
  reserveMonths: number;
  /** Which part drags the total down, or null when everything is fine. */
  weakest: keyof ScoreBreakdown | null;
}

const round = (value: number) => Math.round(value);

/**
 * The PF score, 0-100, from three rules:
 *
 * - On time (40): share of the month's bills marked paid. A month with no
 *   bills counts as fully on time: there is nothing late.
 * - Margin (30): forecast over income, clamped to 0-1. An empty month with
 *   neither income nor spending is neutral at half points.
 * - Reserve (30): reserve-goal savings divided by the month's committed
 *   spending, full marks at six months or more.
 *
 * The weakest share decides the one-line verdict; at 85 or more the month
 * needs no lecture.
 */
export function computeScore(plan: MonthPlan): Score {
  const due = plan.dueBills.length;
  const paid = plan.paidBillIds.length;
  const onTime = due === 0 ? 40 : round((paid / due) * 40);

  const committed = plan.incomeCents - plan.forecastCents;
  const margin =
    plan.incomeCents > 0
      ? round(Math.min(1, Math.max(0, plan.forecastCents / plan.incomeCents)) * 30)
      : committed === 0
        ? 15
        : 0;

  const reserved = plan.goals
    .filter((entry) => entry.goal.kind === "reserve")
    .reduce((sum, entry) => sum + entry.paidCents, 0);
  const burn = Math.max(1, committed);
  const reserveMonths = reserved / burn;
  const reserve = round(Math.min(1, reserveMonths / 6) * 30);

  const total = Math.min(100, onTime + margin + reserve);
  const shares: Array<[keyof ScoreBreakdown, number]> = [
    ["onTime", onTime / 40],
    ["margin", margin / 30],
    ["reserve", reserve / 30],
  ];
  shares.sort((left, right) => left[1] - right[1]);
  return {
    total,
    parts: { onTime, margin, reserve },
    reserveMonths: Math.round(reserveMonths * 10) / 10,
    weakest: total >= 85 ? null : shares[0][0],
  };
}
