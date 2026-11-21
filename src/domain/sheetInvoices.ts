import type { CardMeta, TransactionRow } from "../lib/api";

export interface SheetInvoice {
  card: CardMeta;
  /** The card's entries of the month, oldest first: with cash basis, the invoice due in it. */
  lines: TransactionRow[];
  /** Purchases minus credits, never below zero. */
  totalCents: number;
}

/**
 * Takes the entries of cards set to cash basis out of the month's list and folds each
 * card into one invoice row. With cash basis the month's entries of such a card are
 * exactly the invoice due in that month, so the sheet shows what leaves the account
 * once, with the purchases one click away. Transfers (an invoice payment) stay out.
 */
export function splitCardEntries(entries: TransactionRow[], cards: CardMeta[]): { invoices: SheetInvoice[]; rest: TransactionRow[] } {
  const byAccount = new Map(cards.filter((card) => card.cashBasis).map((card) => [card.accountId, card]));
  const grouped = new Map<number, TransactionRow[]>();
  const rest: TransactionRow[] = [];
  for (const entry of entries) {
    const card = entry.transferGroup == null ? byAccount.get(entry.accountId) : undefined;
    if (!card) {
      rest.push(entry);
      continue;
    }
    grouped.set(card.id, [...(grouped.get(card.id) ?? []), entry]);
  }
  const invoices = cards
    .filter((card) => grouped.has(card.id))
    .map((card) => {
      const lines = [...(grouped.get(card.id) ?? [])].sort((a, b) => a.postedOn.localeCompare(b.postedOn) || a.id - b.id);
      const totalCents = Math.max(0, -lines.reduce((sum, line) => sum + line.amountCents, 0));
      return { card, lines, totalCents };
    });
  return { invoices, rest };
}
