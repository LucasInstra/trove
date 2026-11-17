/**
 * The invoice window of a credit card.
 *
 * The invoice due in a month is the one that closed before it: if the card
 * closes on day 5 and is due on day 12, the invoice due in December closed on
 * 5 December. When the due day comes before the closing day (closes 28, due 5),
 * the invoice due in December closed in November.
 */

import { addMonths, dateInMonth } from "./month";

export interface InvoiceWindow {
  /** Exclusive: the closing date of the previous cycle. */
  from: string;
  /** Inclusive: the closing date of this cycle. */
  to: string;
}

export function invoiceWindow(closingDay: number, dueDay: number, month: string): InvoiceWindow {
  const closing = Math.min(Math.max(1, closingDay), 31);
  const closesLate = dueDay <= closingDay;
  const closingMonth = closesLate ? addMonths(month, -1) : month;
  return {
    from: dateInMonth(addMonths(closingMonth, -1), closing),
    to: dateInMonth(closingMonth, closing),
  };
}

export function isInsideWindow(date: string, window: InvoiceWindow): boolean {
  return date > window.from && date <= window.to;
}

export interface InvoiceEntry {
  postedOn: string;
  amountCents: number;
}

/** What the card moved inside the window: purchases minus credits, never below zero. */
export function invoiceUsage(entries: InvoiceEntry[], window: InvoiceWindow): number {
  let total = 0;
  for (const entry of entries) {
    if (!isInsideWindow(entry.postedOn, window)) continue;
    // A purchase is negative and adds to the invoice; a payment subtracts.
    total -= entry.amountCents;
  }
  return Math.max(0, total);
}

export function invoiceLines<T extends InvoiceEntry>(entries: T[], window: InvoiceWindow): T[] {
  return entries
    .filter((entry) => isInsideWindow(entry.postedOn, window))
    .sort((left, right) => left.postedOn.localeCompare(right.postedOn));
}

/**
 * What is still to pay on an invoice already marked as paid. The invoice grows when a purchase
 * is added or edited after the payment. When the payment is an entry inside the window, `usage`
 * already has it taken off; otherwise the amount recorded at the time is taken off here.
 */
export function invoiceDifference(
  usageCents: number,
  record: { amountCents: number; paidOn: string; transferGroup?: string },
  window: InvoiceWindow,
): number {
  const inLedger = Boolean(record.transferGroup) && record.paidOn !== "" && isInsideWindow(record.paidOn, window);
  const left = inLedger || record.amountCents <= 0 ? usageCents : usageCents - record.amountCents;
  return Math.max(left, 0);
}
