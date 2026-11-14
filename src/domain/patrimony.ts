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

/** Yearly market rates, in percent, used to estimate what an investment earns. */
export interface RateAssumptions {
  cdiPct: number;
  ipcaPct: number;
}

export const DEFAULT_RATES: RateAssumptions = { cdiPct: 14.5, ipcaPct: 4.5 };

export interface InvestmentInput {
  id: number;
  name: string;
  kind: string;
  amountCents: number;
  costCents: number;
  indexer?: string;
  /** Percent of the indexer (cdi, selic) or yearly rate (fixed, ipca spread), times 100. */
  rateBps?: number;
  termMonths?: number;
  startedOn?: string;
}

/** Yearly return as a fraction, or null when the investment says nothing about how it earns. */
export function annualRate(
  indexer: string | undefined,
  rateBps: number | undefined,
  rates: RateAssumptions = DEFAULT_RATES,
): number | null {
  const rate = (rateBps ?? 0) / 10_000;
  if (rate <= 0) return null;
  switch (indexer) {
    case "cdi":
    case "selic":
      return (rates.cdiPct / 100) * rate;
    case "ipca":
      return (1 + rates.ipcaPct / 100) * (1 + rate) - 1;
    case "fixed":
      return rate;
    default:
      return null;
  }
}

/** Whole months left until the end of the term; null without a start date and a term. */
export function monthsLeft(startedOn: string | undefined, termMonths: number | undefined, today: string): number | null {
  if (!startedOn || !termMonths || termMonths <= 0) return null;
  const [y1, m1, d1] = startedOn.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  if ([y1, m1, d1, y2, m2, d2].some((part) => !Number.isFinite(part))) return null;
  let elapsed = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) elapsed -= 1;
  return Math.max(0, termMonths - Math.max(0, elapsed));
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
  indexer: string;
  rateBps: number;
  termMonths: number;
  annualRate: number | null;
  /** Estimated earning over the next month, from the current value. */
  monthlyYieldCents: number | null;
  monthsLeft: number | null;
  /** Estimated value when the term ends. */
  projectedCents: number | null;
  /** Months the earnings below cover: what is left of the term, or a year without one. */
  horizonMonths: number;
  /** What it should pay over the horizon, from today's value. Null without a rate. */
  earningsCents: number | null;
}

export interface InvestmentSummary {
  valueCents: number;
  /** Cost of the lines that report one, and their value, so the return is like for like. */
  trackedCostCents: number;
  trackedValueCents: number;
  gainCents: number;
  gainPct: number | null;
  untracked: number;
  monthlyYieldCents: number;
  /** What the lines with a rate should pay over their own horizon. */
  earningsCents: number;
  /** How many lines say how they earn: the yield above covers only those. */
  withRate: number;
}

/** The investment holdings, biggest first, each with its share of the portfolio. */
export function investmentLines(
  holdings: InvestmentInput[],
  rates: RateAssumptions = DEFAULT_RATES,
  today: string = new Date().toISOString().slice(0, 10),
): InvestmentLine[] {
  const investments = holdings.filter((holding) => holding.kind === "investment");
  const total = investments.reduce((sum, holding) => sum + holding.amountCents, 0);
  return investments
    .map((holding) => {
      const known = holding.costCents > 0;
      const gainCents = known ? holding.amountCents - holding.costCents : null;
      const yearly = annualRate(holding.indexer, holding.rateBps, rates);
      const left = monthsLeft(holding.startedOn, holding.termMonths, today);
      return {
        id: holding.id,
        name: holding.name,
        valueCents: holding.amountCents,
        costCents: holding.costCents,
        gainCents,
        gainPct: known && gainCents !== null ? (gainCents / holding.costCents) * 100 : null,
        sharePct: total > 0 ? (holding.amountCents / total) * 100 : 0,
        indexer: holding.indexer ?? "none",
        rateBps: holding.rateBps ?? 0,
        termMonths: holding.termMonths ?? 0,
        annualRate: yearly,
        monthlyYieldCents:
          yearly === null ? null : Math.round(holding.amountCents * (Math.pow(1 + yearly, 1 / 12) - 1)),
        monthsLeft: left,
        horizonMonths: left !== null && left > 0 ? left : 12,
        earningsCents:
          yearly === null
            ? null
            : Math.round(
                holding.amountCents * (Math.pow(1 + yearly, (left !== null && left > 0 ? left : 12) / 12) - 1),
              ),
        projectedCents:
          yearly === null || left === null
            ? null
            : Math.round(holding.amountCents * Math.pow(1 + yearly, left / 12)),
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
    earningsCents: lines.reduce((sum, line) => sum + (line.earningsCents ?? 0), 0),
    monthlyYieldCents: lines.reduce((sum, line) => sum + (line.monthlyYieldCents ?? 0), 0),
    withRate: lines.filter((line) => line.monthlyYieldCents !== null).length,
  };
}
