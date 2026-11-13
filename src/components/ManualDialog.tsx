import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
import { parseCents } from "./PlannerDialogs";
import type { Account, Category, ManualEdit, ManualInput, TransactionRow } from "../lib/api";
import { todayIso } from "../lib/format";
import { categoryName } from "../lib/i18n";
import { useLanguage } from "../lib/language";

/**
 * A hand-entered row: type, description, amount, date, account, category and
 * an optional note. It lands in the ledger next to the imports but never
 * through the dedupe. Editing reopens the same form prefilled; imported rows
 * never reach it.
 */
export function ManualDialog({
  accounts,
  categories,
  entry,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  accounts: Account[];
  categories: Category[];
  entry?: TransactionRow | null;
  onClose: () => void;
  onCreate: (input: ManualInput) => void;
  onUpdate: (input: ManualEdit) => void;
  onDelete?: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<"expense" | "income">(entry && entry.amountCents >= 0 ? "income" : "expense");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [amount, setAmount] = useState(entry ? (Math.abs(entry.amountCents) / 100).toFixed(2) : "");
  const [date, setDate] = useState(entry?.postedOn.slice(0, 10) ?? todayIso());
  const [accountId, setAccountId] = useState(entry?.accountId ?? accounts[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState<number | null>(entry?.categoryId ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? "");

  return (
    <Dialog title={entry ? t("manual.editTitle") : t("manual.title")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseCents(amount);
          if (cents === 0 || accountId === 0) return;
          const base = {
            accountId,
            postedOn: date,
            amountCents: kind === "expense" ? -cents : cents,
            description: description.trim(),
            categoryId,
            notes: notes.trim(),
          };
          if (entry) onUpdate({ ...base, id: entry.id });
          else onCreate(base);
        }}
      >
        <div className="segmented" role="group" aria-label={t("manual.type")}>
          {(["expense", "income"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={kind === option ? "active" : undefined}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
            >
              {t(option === "expense" ? "manual.expense" : "manual.income")}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t("planner.name")}</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} required />
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
          <span>{t("manual.date")}</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="field">
          <span>{t("planner.account")}</span>
          <select value={accountId} onChange={(event) => setAccountId(Number(event.target.value))}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("planner.category")}</span>
          <select
            value={categoryId ?? ""}
            onChange={(event) =>
              setCategoryId(event.target.value === "" ? null : Number(event.target.value))
            }
          >
            <option value="">{t("ledger.noCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryName(t, category.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("manual.notes")}</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <div className="dialog-actions">
          {entry && onDelete ? (
            <button type="button" className="ghost danger" onClick={() => onDelete(entry.id)}>
              <Icon name="trash" size={15} />
              {t("common.delete")}
            </button>
          ) : null}
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
