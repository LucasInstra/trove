import type { MonthPoint } from "../lib/api";

export interface WealthPoint extends MonthPoint {
  netCents: number;
  runningCents: number;
}

/**
 * The net-worth curve the statements support: monthly net plus its running
 * total. It starts at zero, so it reads as the period's accumulation, not as
 * an absolute fortune. Reserves live apart, in the goals.
 */
export function netWorthCurve(series: MonthPoint[]): WealthPoint[] {
  let running = 0;
  return series.map((point) => {
    const net = point.incomeCents - point.expenseCents;
    running += net;
    return { ...point, netCents: net, runningCents: running };
  });
}
