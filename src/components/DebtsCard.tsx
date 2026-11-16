import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
import { IconBubble } from "./editorial";
import { Icon3D } from "./Icon3D";
import { Money } from "./Money";
import { parseCents } from "./PlannerDialogs";
import type { Debt, DebtInput } from "../lib/api";
import { formatCents, monthLabel } from "../lib/format";
import { useLanguage } from "../lib/language";

export function DebtDialog({
  debt,
  month,
  onClose,
  onSave,
  onDelete,
}: {
  debt: Debt | null;
  month: string;
  onClose: () => void;
  onSave: (input: DebtInput) => void;
  onDelete?: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [debtor, setDebtor] = useState(debt?.personName ?? "");
  const [label, setLabel] = useState(debt?.label ?? "");
  const [amount, setAmount] = useState(debt ? (debt.amountCents / 100).toFixed(2) : "");

  return (
    <Dialog title={debt ? t("debts.editDebt") : t("debts.newDebt")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseCents(amount);
          if (cents <= 0 || debtor.trim() === "") return;
          onSave({
            id: debt?.id ?? null,
            debtor: debtor.trim(),
            label: label.trim(),
            amountCents: cents,
            month: debt?.month ?? month,
          });
        }}
      >
        <label className="field">
          <span>{t("debts.person")}</span>
          <input value={debtor} maxLength={80} onChange={(event) => setDebtor(event.target.value)} required />
        </label>
        <label className="field">
          <span>{t("debts.label")}</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} required />
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
        <div className="dialog-actions">
          {debt && onDelete ? (
            <button type="button" className="ghost danger" onClick={() => onDelete(debt.id)}>
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

/**
 * Money other people owe me this month: who, what for, how much, and a
 * per-debt received mark. Settling one never touches the others.
 */
export function DebtsCard({
  debts,
  month,
  onToggleSettled,
  onAdd,
  onEdit,
  compact = false,
}: {
  debts: Debt[];
  month: string;
  onToggleSettled: (id: number, settled: boolean) => void;
  onAdd: () => void;
  /** Opens the debt to edit it or delete it. */
  onEdit?: (debt: Debt) => void;
  compact?: boolean;
}) {
  const { lang, t } = useLanguage();
  const open = debts.filter((debt) => !debt.settledOn);
  const settled = debts.filter((debt) => Boolean(debt.settledOn));
  const total = open.reduce((sum, debt) => sum + debt.amountCents, 0);

  if (compact) {
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="wallet-plus" size={22} />
          <span className="compact-title">{t("debts.title")}</span>
          <span className="compact-value">{formatCents(total)}</span>
        </div>
        {open.length > 0 ? (
          <div className="compact-body">
            <span className="muted small">
              {open[0].label} · {formatCents(open[0].amountCents)}
            </span>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <IconBubble name="wallet-plus" size="sm" />
          <h2>{t("debts.title")}</h2>
        </div>
        <button type="button" className="round-button" onClick={onAdd} aria-label={t("debts.newDebt")}>
          <Icon name="plus" size={16} />
        </button>
      </header>

      {debts.length === 0 ? (
        <p className="card-empty">{t("debts.empty")}</p>
      ) : (
        <>
          <div className="card-figure">
            <Money cents={total} />
            <span className="muted small">{monthLabel(month, lang)}</span>
          </div>
          <ul className="debt-list">
            {[...open, ...settled].map((debt) => {
              const received = Boolean(debt.settledOn);
              return (
                <li key={debt.id} className={received ? "debt settled" : "debt"}>
                  <div className="debt-main">
                    <span className="debt-name">{debt.label}</span>
                    <span className="muted small">
                      {debt.personName ?? ""} · {monthLabel(debt.month, lang)}
                    </span>
                  </div>
                  <span className="debt-amount">{formatCents(debt.amountCents)}</span>
                  <label className="debt-check" title={received ? t("debts.received") : t("debts.markReceived")}>
                    <input
                      type="checkbox"
                      checked={received}
                      aria-label={`${t("debts.markReceived")}: ${debt.label}`}
                      onChange={() => onToggleSettled(debt.id, !received)}
                    />
                  </label>
                  {onEdit ? (
                    <button type="button" className="icon-button" title={t("common.edit")} aria-label={`${t("common.edit")}: ${debt.label}`} onClick={() => onEdit(debt)}>
                      <Icon name="pencil" size={15} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}
