import type { Bill } from "../lib/api";

export interface Installment {
  /** 1-based parcel falling in the month. */
  current: number;
  /** Total parcels of the purchase. */
  total: number;
}

/** Whole months from `start` ("YYYY-MM") to `month` ("YYYY-MM"). Negative when `month` comes first. */
export function monthOffset(start: string, month: string): number {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [year, value] = month.split("-").map(Number);
  return (year - startYear) * 12 + (value - startMonth);
}

/**
 * Which parcel of an installment purchase falls in `month`. Null when the
 * bill is not an installment purchase, is inactive, or the month sits outside
 * its run. No row per parcel is stored: the count derives from `startsOn`.
 */
export function installmentOf(bill: Bill, month: string): Installment | null {
  const total = bill.installmentsTotal;
  if (!bill.active || total === null || total === undefined || total < 1) return null;
  const whole = Math.floor(total);
  const offset = monthOffset(bill.startsOn.slice(0, 7), month);
  if (offset < 0 || offset >= whole) return null;
  return { current: offset + 1, total: whole };
}
