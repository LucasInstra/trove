import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const SETTING = "invoices_paid";
export const INVOICES_EVENT = "trove:invoices";
/** Raised when a payment entry was created or removed, so the ledger reloads. */
export const LEDGER_EVENT = "trove:ledger";

/** What was recorded when an invoice was marked as paid. */
export interface PaidInvoice {
  /** The invoice total at the time it was paid. */
  amountCents: number;
  /** Day the payment was made, YYYY-MM-DD. */
  paidOn: string;
  /** Group of the transfer entry created for the payment, when the user chose an account. */
  transferGroup?: string;
}

type Records = Record<string, PaidInvoice>;

const keyOf = (cardId: number, month: string) => `${cardId}:${month}`;

function parse(value: string | null): Records {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    // The first version stored a plain list of keys: those were paid without a recorded amount.
    if (Array.isArray(parsed)) return Object.fromEntries((parsed as string[]).map((key) => [key, { amountCents: 0, paidOn: "" }]));
    return parsed && typeof parsed === "object" ? (parsed as Records) : {};
  } catch {
    return {};
  }
}

/**
 * Sum of the invoice payments made in a month, by payment date. A record without a date (the
 * first version) counts in the invoice's own month.
 */
export function invoicePaymentsIn(records: Record<string, PaidInvoice>, month: string): number {
  return Object.entries(records).reduce((sum, [key, record]) => {
    const when = record.paidOn ? record.paidOn.slice(0, 7) : key.slice(key.indexOf(":") + 1);
    return when === month ? sum + record.amountCents : sum;
  }, 0);
}

/** Which card invoices were marked as paid, kept in the settings by "cardId:YYYY-MM". */
export function usePaidInvoices() {
  const [records, setRecords] = useState<Records>({});

  useEffect(() => {
    const read = () => {
      api
        .getSetting(SETTING)
        .then((value) => setRecords(parse(value)))
        .catch(() => {});
    };
    read();
    window.addEventListener(INVOICES_EVENT, read);
    return () => window.removeEventListener(INVOICES_EVENT, read);
  }, []);

  const save = useCallback(async (next: Records) => {
    setRecords(next);
    await api.setSetting(SETTING, JSON.stringify(next));
    window.dispatchEvent(new Event(INVOICES_EVENT));
  }, []);

  const isPaid = useCallback((cardId: number, month: string) => keyOf(cardId, month) in records, [records]);
  /** Invoice payments whose money leaves in this month, whatever month the invoice belongs to. */
  const paidOutIn = useCallback((month: string) => invoicePaymentsIn(records, month), [records]);
  const paidInvoice = useCallback((cardId: number, month: string) => records[keyOf(cardId, month)] ?? null, [records]);

  const markPaid = useCallback(
    (cardId: number, month: string, record: PaidInvoice) => save({ ...records, [keyOf(cardId, month)]: record }),
    [records, save],
  );

  /** Undoes the payment, and removes the entry it created. */
  const unmarkPaid = useCallback(
    async (cardId: number, month: string) => {
      const key = keyOf(cardId, month);
      const record = records[key];
      if (record?.transferGroup && record.paidOn) {
        const rows = await api.transactions(undefined, record.paidOn.slice(0, 7), null, 500).catch(() => []);
        const entry = rows.find((row) => row.transferGroup === record.transferGroup);
        if (entry) await api.deleteTransfer(entry.id).catch(() => undefined);
        window.dispatchEvent(new Event(LEDGER_EVENT));
      }
      const { [key]: _removed, ...rest } = records;
      await save(rest);
    },
    [records, save],
  );

  return { isPaid, paidInvoice, paidOutIn, markPaid, unmarkPaid };
}
