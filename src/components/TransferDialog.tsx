import { useState } from "react";
import { Dialog } from "./Dialog";
import { parseCents } from "./PlannerDialogs";
import type { Account, TransferInput } from "../lib/api";
import { todayIso } from "../lib/format";
import { useLanguage } from "../lib/language";

/**
 * Moves money between own accounts: one form, two mirrored legs. The pair
 * stays out of income, spending and categories, and only vanishes together.
 */
export function TransferDialog({
  accounts,
  onClose,
  onSave,
}: {
  accounts: Account[];
  onClose: () => void;
  onSave: (input: TransferInput) => void;
}) {
  const { t } = useLanguage();
  const [from, setFrom] = useState(accounts[0]?.id ?? 0);
  const [to, setTo] = useState(accounts[1]?.id ?? accounts[0]?.id ?? 0);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog title={t("transfer.title")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseCents(amount);
          if (cents <= 0 || from === 0 || to === 0 || from === to) return;
          if (description.trim() === "") return;
          onSave({
            fromAccountId: from,
            toAccountId: to,
            postedOn: date,
            amountCents: cents,
            description: description.trim(),
            notes: notes.trim(),
          });
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>{t("transfer.from")}</span>
            <select value={from} onChange={(event) => setFrom(Number(event.target.value))}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("transfer.to")}</span>
            <select value={to} onChange={(event) => setTo(Number(event.target.value))}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t("manual.date")}</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="field">
          <span>{t("planner.amount")}</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label className="field">
          <span>{t("planner.name")}</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>{t("manual.notes")}</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {from === to ? <p className="muted small">{t("transfer.sameAccount")}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
