import { addMonths } from "./month";

export interface ForecastPoint {
  month: string;
  balanceCents: number;
}

/**
 * Short-horizon cash sketch: the same monthly delta repeated, compounded on
 * the starting balance. The inputs are averages the caller computed (usually
 * trailing months), so this function stays honest arithmetic with no data
 * access and no hidden smoothing.
 */
export function projectCash(
  startMonth: string,
  startCents: number,
  monthlyIncomeCents: number,
  monthlySpendCents: number,
  months: number,
): ForecastPoint[] {
  const count = Math.max(0, Math.min(12, Math.floor(months)));
  const delta = Math.round(monthlyIncomeCents) - Math.round(monthlySpendCents);
  const points: ForecastPoint[] = [];
  let balance = Math.round(startCents);
  for (let offset = 1; offset <= count; offset++) {
    balance += delta;
    points.push({ month: addMonths(startMonth, offset), balanceCents: balance });
  }
  return points;
}

/** Mean of the trailing months, rounded. Empty in, zero out. */
export function averageOf(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
