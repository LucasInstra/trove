import type { Bill } from "../lib/api";

export type BillScope = "house" | "personal";

/**
 * Which side of the household a bill belongs to. No new model: a bill is "of
 * the house" when its category is the housing one, everything else is
 * personal. The split between people already lives in the shares.
 */
export function scopeOfBill(bill: Bill, housingCategoryId: number | null): BillScope {
  if (housingCategoryId !== null && bill.categoryId === housingCategoryId) return "house";
  return "personal";
}
