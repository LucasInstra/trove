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

export interface InvestmentInput {
  id: number;
  name: string;
  kind: string;
  amountCents: number;
  costCents: number;
}

export interface InvestmentLine {
  id: number;
  name: string;
  valueCents: number;
  costCents: number;
  /** Null while the cost is unknown: nothing to compare the value with. */
  gainCents: number | null;
  gainPct: number | null;
  sharePct: number;
}

export interface InvestmentSummary {
  valueCents: number;
  /** Cost of the lines that report one, and their value, so the return is like for like. */
  trackedCostCents: number;
  trackedValueCents: number;
  gainCents: number;
  gainPct: number | null;
  untracked: number;
}

/** The investment holdings, biggest first, each with its share of the portfolio. */
export function investmentLines(holdings: InvestmentInput[]): InvestmentLine[] {
  const investments = holdings.filter((holding) => holding.kind === "investment");
  const total = investments.reduce((sum, holding) => sum + holding.amountCents, 0);
  return investments
    .map((holding) => {
      const known = holding.costCents > 0;
      const gainCents = known ? holding.amountCents - holding.costCents : null;
      return {
        id: holding.id,
        name: holding.name,
        valueCents: holding.amountCents,
        costCents: holding.costCents,
        gainCents,
        gainPct: known && gainCents !== null ? (gainCents / holding.costCents) * 100 : null,
        sharePct: total > 0 ? (holding.amountCents / total) * 100 : 0,
      };
    })
    .sort((left, right) => right.valueCents - left.valueCents);
}

export function investmentSummary(lines: InvestmentLine[]): InvestmentSummary {
  const tracked = lines.filter((line) => line.gainCents !== null);
  const trackedCostCents = tracked.reduce((sum, line) => sum + line.costCents, 0);
  const trackedValueCents = tracked.reduce((sum, line) => sum + line.valueCents, 0);
  const gainCents = trackedValueCents - trackedCostCents;
  return {
    valueCents: lines.reduce((sum, line) => sum + line.valueCents, 0),
    trackedCostCents,
    trackedValueCents,
    gainCents,
    gainPct: trackedCostCents > 0 ? (gainCents / trackedCostCents) * 100 : null,
    untracked: lines.length - tracked.length,
  };
}
