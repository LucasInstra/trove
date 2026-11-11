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

export interface HoldingLike {
  kind: string;
  amountCents: number;
}

/** Off-ledger assets add up; the ledger curve and the goal reserves join in. */
export function holdingsTotal(holdings: HoldingLike[]): number {
  return holdings.reduce((sum, holding) => sum + holding.amountCents, 0);
}

export interface KindTotal {
  kind: string;
  totalCents: number;
}

/** Subtotals per kind, biggest first, for the holdings list. */
export function holdingsByKind(holdings: HoldingLike[]): KindTotal[] {
  const map = new Map<string, number>();
  for (const holding of holdings) {
    map.set(holding.kind, (map.get(holding.kind) ?? 0) + holding.amountCents);
  }
  return [...map.entries()]
    .map(([kind, totalCents]) => ({ kind, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Absolute net worth: reserves plus the period's accumulation plus holdings. */
export function totalWealth(reservesCents: number, accumulatedCents: number, holdingsCents: number): number {
  return reservesCents + accumulatedCents + holdingsCents;
}
