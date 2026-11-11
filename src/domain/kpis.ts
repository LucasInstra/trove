import type { MonthPoint } from "../lib/api";
import type { MonthPlan } from "./projection";
import { remainingInstallments } from "./installment";

export interface KpiDatum {
  /** Current month value, in cents. */
  valueCents: number;
  /** Previous month value, in cents, or null when there is no earlier point. */
  prevCents: number | null;
  /** Percent change against the previous month, or null when not computable. */
  deltaPct: number | null;
}

export interface Kpis {
  income: KpiDatum;
  expense: KpiDatum;
  balance: KpiDatum;
  /** Parcel value freed up: installments paying their last parcel this month. */
  freed: KpiDatum;
  /** Previous month id ("YYYY-MM") for the delta label, or null. */
  prevMonth: string | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function datum(valueCents: number, prevCents: number | null): KpiDatum {
  if (prevCents === null || prevCents === 0) {
    return { valueCents, prevCents, deltaPct: null };
  }
  return { valueCents, prevCents, deltaPct: round1(((valueCents - prevCents) / Math.abs(prevCents)) * 100) };
}

/**
 * The three headline numbers and their change against the previous month.
 * Expense follows the same rule as the forecast: planned when the month has
 * bills, realized spending otherwise.
 */
export function computeKpis(plan: MonthPlan, series: MonthPoint[], month: string): Kpis {
  const index = series.findIndex((point) => point.month === month);
  const prev = index > 0 ? series[index - 1] : null;

  const incomeCents = plan.incomeCents;
  const expenseCents = plan.hasPlan ? plan.plannedCents : plan.realizedCents;
  const freedCents = plan.dueBills.reduce((sum, bill) => {
    const remaining = remainingInstallments(bill, month);
    return remaining && remaining.left === 0 ? sum + bill.amountCents : sum;
  }, 0);
  return {
    income: datum(incomeCents, prev?.incomeCents ?? null),
    expense: datum(expenseCents, prev?.expenseCents ?? null),
    balance: datum(plan.forecastCents, prev ? prev.incomeCents - prev.expenseCents : null),
    freed: datum(freedCents, null),
    prevMonth: prev?.month ?? null,
  };
}
