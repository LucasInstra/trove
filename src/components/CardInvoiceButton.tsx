import { useRef, useState } from "react";
import type { CardMeta, TransactionRow } from "../lib/api";
import { api } from "../lib/api";
import type { InvoiceWindow } from "../domain/invoice";
import { invoiceDifference, invoiceLines, invoiceUsage } from "../domain/invoice";
import { Icon } from "./Icons";
import { dateInMonth } from "../domain/month";
import { useLanguage } from "../lib/language";
import { usePaidInvoices } from "../lib/paidInvoices";
import { InvoiceDialog } from "./InvoiceDialog";
import { PayInvoiceDialog } from "./PayInvoiceDialog";

interface Props {
  card: CardMeta;
  month: string;
  window: InvoiceWindow;
  usageCents: number;
}

/** "See invoice" on one card: loads the card's statement rows on demand and opens its invoice. */
export function CardInvoiceButton({ card, month, window, usageCents }: Props) {
  const { t } = useLanguage();
  const invoices = usePaidInvoices();
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const request = useRef(0);

  // Rows are read again on every open, so an edited purchase shows up; a late
  // answer from an older open is dropped.
  const show = async () => {
    const id = ++request.current;
    setRows(null);
    setOpen(true);
    const list = await api.transactions(undefined, undefined, card.accountId, 2000).catch(() => [] as TransactionRow[]);
    if (id === request.current) setRows(list);
  };
  const close = () => {
    request.current++;
    setOpen(false);
  };

  // usageCents from the screen is already net of a payment; the gross invoice
  // comes from the rows, as in CardsCard.
  const gross = rows ? invoiceUsage(rows, window) : usageCents;

  const paid = invoices.isPaid(card.id, month);
  const record = invoices.paidInvoice(card.id, month);
  const paidCents = record && record.amountCents > 0 ? record.amountCents : gross;
  const extraCents = paid && record ? invoiceDifference(gross, record, window) : 0;
  const togglePaid = () => {
    if (paid) void invoices.unmarkPaid(card.id, month);
    else setPayOpen(true);
  };

  return (
    <>
      <button type="button" className="outline-button" disabled={open && !rows} onClick={() => void show()}>
        <Icon name="file-text" size={16} />
        {t("planner.viewInvoice")}
      </button>
      {open && rows ? (
        <InvoiceDialog
          card={card}
          month={month}
          window={window}
          dueDate={dateInMonth(month, card.dueDay)}
          lines={rows ? invoiceLines(rows, window) : []}
          totalCents={gross}
          paid={paid}
          paidCents={paidCents}
          onTogglePaid={togglePaid}
          onClose={close}
        />
      ) : null}
      {payOpen ? (
        <PayInvoiceDialog
          card={card}
          month={month}
          amountCents={extraCents > 0 ? extraCents : gross}
          onPaid={(paidRecord) =>
            void invoices.markPaid(
              card.id,
              month,
              extraCents > 0 ? { ...paidRecord, amountCents: paidCents + paidRecord.amountCents } : paidRecord,
            )
          }
          onClose={() => setPayOpen(false)}
        />
      ) : null}
    </>
  );
}
