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
