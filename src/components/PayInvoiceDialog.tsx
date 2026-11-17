import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Account, CardMeta } from "../lib/api";
import { formatCents, monthLabel } from "../lib/format";
import { useLanguage } from "../lib/language";
import { LEDGER_EVENT } from "../lib/paidInvoices";
import type { PaidInvoice } from "../lib/paidInvoices";
import { Dialog } from "./Dialog";

const NONE = "";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** The category card payments are filed under, created the first time it is needed. */
async function cardCategory(name: string): Promise<number | null> {
  const all = await api.categories().catch(() => []);
  const found = all.find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  return api
    .saveCategory({ id: null, name, kind: "expense", color: "#6366f1", parentId: null, emoji: "💳", sortOrder: all.length + 1 })
    .catch(() => null);
}

/**
 * Asks which account paid the invoice and when. The payment becomes a transfer from
 * that account to the card, so the money leaves the account without counting as a
 * second expense: the purchases are already in the ledger.
 */
export function PayInvoiceDialog({
  card,
  month,
  amountCents,
  onPaid,
  onClose,
}: {
  card: CardMeta;
  month: string;
  amountCents: number;
  onPaid: (record: PaidInvoice) => void;
  onClose: () => void;
}) {
  const { lang, t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState(NONE);
  const [paidOn, setPaidOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .accounts()
      .then((list) => {
        const others = list.filter((account) => account.id !== card.accountId);
        setAccounts(others);
        if (others.length > 0) setAccountId(String(others[0].id));
      })
      .catch(() => {});
  }, [card.accountId]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      let transferGroup: string | undefined;
      if (accountId !== NONE && amountCents > 0) {
        transferGroup = await api.saveTransfer({
          fromAccountId: Number(accountId),
          toAccountId: card.accountId,
          postedOn: paidOn,
          amountCents,
          description: t("planner.payDescription", { card: card.brand || t("planner.card"), month: monthLabel(month, lang) }),
          notes: "",
        });
        const categoryId = await cardCategory(t("planner.payCategory"));
        await api.setTransferCategory(transferGroup, categoryId).catch(() => undefined);
        window.dispatchEvent(new Event(LEDGER_EVENT));
      }
      onPaid({ amountCents, paidOn, transferGroup });
      onClose();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
      setBusy(false);
    }
  };

  return (
    <Dialog title={t("planner.payTitle", { month: monthLabel(month, lang) })} onClose={onClose}>
      <div className="dialog-form">
        <p>
          <strong>{formatCents(amountCents)}</strong>
        </p>
        <label className="field">
          <span>{t("planner.payAccount")}</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
            <option value={NONE}>{t("planner.payNoEntry")}</option>
          </select>
          <small className="field-hint">{t("planner.payHint")}</small>
        </label>
        <label className="field">
          <span>{t("planner.payDate")}</span>
          <input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required />
        </label>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className="primary" disabled={busy || !paidOn} onClick={() => void confirm()}>
            {t("planner.payConfirm")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
