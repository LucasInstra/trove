import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
import type { CardMeta, TransactionRow } from "../lib/api";
import type { InvoiceWindow } from "../domain/invoice";
import { formatCents, formatDate, monthLabel } from "../lib/format";
import { useLanguage } from "../lib/language";

interface Props {
  card: CardMeta;
  month: string;
  window: InvoiceWindow;
  dueDate: string;
  lines: TransactionRow[];
  totalCents: number;
  onClose: () => void;
}

/** The invoice of one card and one month, straight from the statement window. */
export function InvoiceDialog({ card, month, window, dueDate, lines, totalCents, onClose }: Props) {
  const { lang, t } = useLanguage();

  return (
    <Dialog title={t("planner.invoiceTitle", { month: monthLabel(month, lang) })} onClose={onClose}>
      <div className="invoice-summary">
        <div>
          <span className="muted small">{card.brand || t("planner.card")}</span>
          <strong>
            {formatCents(totalCents)}
          </strong>
        </div>
        <div className="invoice-dates">
          <span className="muted small">{t("planner.dueDate", { date: formatDate(dueDate) })}</span>
          <span className="muted small">{t("planner.closesOn", { date: formatDate(window.to) })}</span>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="card-empty">{t("planner.noInvoiceLines")}</p>
      ) : (
        <>
          <ul className="invoice-list">
            {lines.map((row) => (
              <li key={row.id}>
                <span className="invoice-date">{row.postedOn.slice(8, 10)}</span>
                <span className="invoice-name">{row.merchant || row.description}</span>
                <span className="invoice-amount">{formatCents(-row.amountCents)}</span>
              </li>
            ))}
          </ul>
          <p className="muted small invoice-foot">
            {t("planner.invoiceLines", { count: lines.length })}
          </p>
        </>
      )}

      <div className="dialog-actions">
        <button type="button" className="ghost" onClick={onClose}>
          <Icon name="x" size={16} />
          {t("common.close")}
        </button>
      </div>
    </Dialog>
  );
}
