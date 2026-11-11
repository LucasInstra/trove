export interface RetirementPoint {
  /** Years from now, 0 is today. */
  year: number;
  balanceCents: number;
}

export interface RetirementInput {
  /** Already saved, in cents. */
  currentCents: number;
  /** Monthly contribution, in cents. */
  monthlyCents: number;
  /** Horizon in whole years. */
  years: number;
  /** Hypothetical annual return, percent (6 means 6% a year). */
  annualRatePct: number;
}

/**
 * Where steady contributions land. Monthly compounding at a hypothetical
 * flat rate, contributions at the end of each month, no inflation, no tax:
 * a planning sketch, not a promise.
 */
export function retirementProjection(input: RetirementInput): RetirementPoint[] {
  const months = Math.max(0, Math.round(input.years)) * 12;
  const monthly = Math.max(0, input.monthlyCents);
  const factor = 1 + Math.max(0, input.annualRatePct) / 100 / 12;
  let balance = Math.max(0, input.currentCents);
  const points: RetirementPoint[] = [{ year: 0, balanceCents: Math.round(balance) }];
  for (let index = 1; index <= months; index++) {
    balance = balance * factor + monthly;
    if (index % 12 === 0) points.push({ year: index / 12, balanceCents: Math.round(balance) });
  }
  return points;
}
