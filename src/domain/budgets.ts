import { daysInMonth } from "./month";

type PaceStatus = "ok" | "watch" | "over";

export interface Pace {
  expectedCents: number;
  remainingCents: number;
  perDayCents: number;
  status: PaceStatus;
}

/**
 * Where a budget stands today. `todayYmd` is clamped into the month, so past
 * months read final and future months read untouched. Everything stays in
 * integer cents: the expected share rounds down, the daily allowance rounds
 * down, and both floor at zero.
 */
export function paceOf(
  spentCents: number,
  effectiveCents: number,
  todayYmd: string,
  month: string,
): Pace {
  const [year, index] = month.split("-").map(Number);
  const days = daysInMonth(year, index);
  const todayDay = Number(todayYmd.slice(8, 10));
  const endDay = `${month}-`;
  const day = todayYmd.startsWith(endDay)
    ? Math.min(Math.max(1, todayDay), days)
    : todayYmd < endDay
      ? 0
      : days;
  const expectedCents = day <= 0 ? 0 : Math.floor((effectiveCents * day) / days);
  const remainingCents = effectiveCents - spentCents;
  const daysLeft = Math.max(1, days - day + 1);
  const status: PaceStatus =
    spentCents > effectiveCents ? "over" : spentCents > expectedCents ? "watch" : "ok";
  return {
    expectedCents,
    remainingCents,
    perDayCents: Math.max(0, Math.floor(remainingCents / daysLeft)),
    status,
  };
}

/**
 * What can still be spent under the whole-month cap. Without a cap there is
 * no promise to keep, so the answer is null instead of a guess.
 */
export function freeToSpend(expenseCents: number, globalEffectiveCents: number | null): number | null {
  if (globalEffectiveCents === null) return null;
  return globalEffectiveCents - expenseCents;
}
