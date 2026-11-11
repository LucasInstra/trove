import { useState } from "react";
import { Dialog } from "./Dialog";
import { parseCents } from "./PlannerDialogs";
import type { Account, Category, ManualInput } from "../lib/api";
import { todayIso } from "../lib/format";
import { useLanguage } from "../lib/language";

/**
 * A hand-entered row: type, description, amount, date, account and category.
 * It lands in the ledger next to the imports but never through the dedupe.
 */
export function ManualDialog({
  accounts,
  categories,
  onClose,
  onSave,
}: {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSave: (input: ManualInput) => void;
}) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  return (
    <Dialog title={t("manual.title")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseCents(amount);
          if (cents === 0 || accountId === 0) return;
          onSave({
            accountId,
            postedOn: date,
            amountCents: kind === "expense" ? -cents : cents,
            description: description.trim(),
            categoryId,
            // Notes get their own field with the edit dialog.
            notes: "",
          });
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
                {category.name}
              </option>
            ))}
          </select>
        </label>
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
