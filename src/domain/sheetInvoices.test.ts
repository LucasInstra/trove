import { describe, expect, it } from "vitest";
import type { CardMeta, TransactionRow } from "../lib/api";
import { splitCardEntries } from "./sheetInvoices";

const card = (id: number, accountId: number, cashBasis: boolean) => ({ id, accountId, brand: "Nubank", closingDay: 24, dueDay: 1, cashBasis }) as unknown as CardMeta;
const row = (id: number, accountId: number, amountCents: number, postedOn: string, transferGroup: string | null = null) =>
  ({ id, accountId, amountCents, postedOn, transferGroup, tags: [] }) as unknown as TransactionRow;

describe("splitCardEntries", () => {
  it("folds the entries of a cash basis card into one invoice and keeps the rest", () => {
    const entries = [row(1, 10, -30000, "2026-11-05"), row(2, 10, -5000, "2026-10-30"), row(3, 10, 2000, "2026-11-02"), row(4, 20, -9000, "2026-12-03"), row(5, 10, 188700, "2026-12-01", "g1")];
    const { invoices, rest } = splitCardEntries(entries, [card(1, 10, true)]);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].lines.map((line) => line.id)).toEqual([2, 3, 1]);
    expect(invoices[0].totalCents).toBe(33000);
    expect(rest.map((entry) => entry.id)).toEqual([4, 5]);
  });

  it("leaves cards on purchase date alone", () => {
    const entries = [row(1, 10, -30000, "2026-11-05")];
    const { invoices, rest } = splitCardEntries(entries, [card(1, 10, false)]);
    expect(invoices).toEqual([]);
    expect(rest).toHaveLength(1);
  });

  it("never shows a negative invoice", () => {
    const { invoices } = splitCardEntries([row(1, 10, 5000, "2026-11-05")], [card(1, 10, true)]);
    expect(invoices[0].totalCents).toBe(0);
  });
});
