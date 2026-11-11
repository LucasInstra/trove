import { useState } from "react";
import { Dialog } from "./Dialog";
import type { BillInput, CardInput, Category, DepositInput, GoalInput, IncomeInput, Bill, Income, CardMeta, Goal } from "../lib/api";
import { monthLabel } from "../lib/format";
import { useLanguage } from "../lib/language";

const today = () => new Date().toISOString().slice(0, 10);

/** Money typed as "1.234,56" or "1234.56" becomes integer cents. */
export function parseCents(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.abs(value) * 100);
}

/** "24" becomes 24 parcels; anything else becomes a regular bill. */
export function parseInstallments(raw: string): number | null {
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(value) && value >= 2 ? value : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function IncomeDialog({ income, onClose, onSave }: { income: Income | null; onClose: () => void; onSave: (input: IncomeInput) => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState(income?.name ?? t("planner.incomeDefault"));
  const [amount, setAmount] = useState(income ? (income.amountCents / 100).toFixed(2) : "");
  const [payDay, setPayDay] = useState(income?.payDay ?? 5);

  return (
    <Dialog title={t("planner.incomeTitle")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: income?.id ?? null,
            name: name.trim() || t("planner.incomeDefault"),
            amountCents: parseCents(amount),
            frequency: "monthly",
            payDay,
            accountId: income?.accountId ?? null,
            active: income?.active ?? true,
          });
        }}
      >
        <Field label={t("planner.name")}>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label={t("planner.amount")}>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
        </Field>
        <Field label={t("planner.payDay")}>
          <input type="number" min={1} max={31} value={payDay} onChange={(event) => setPayDay(Number(event.target.value))} />
        </Field>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary">{t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function BillDialog({
  bill,
  categories,
  defaultCategoryId = null,
  onClose,
  onSave,
  onDelete,
}: {
  bill: Bill | null;
  categories: Category[];
  defaultCategoryId?: number | null;
  onClose: () => void;
  onSave: (input: BillInput) => void;
  onDelete?: (id: number) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? (bill.amountCents / 100).toFixed(2) : "");
  const [dueDay, setDueDay] = useState(bill?.dueDay ?? 5);
  const [categoryId, setCategoryId] = useState<number | null>(bill?.categoryId ?? defaultCategoryId);
  const [installments, setInstallments] = useState(
    bill?.installmentsTotal ? String(bill.installmentsTotal) : "",
  );

  return (
    <Dialog title={bill ? t("planner.editBill") : t("planner.newBill")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: bill?.id ?? null,
            name: name.trim() || t("planner.newBill"),
            amountCents: parseCents(amount),
            dueDay,
            frequency: bill?.frequency ?? "monthly",
            categoryId,
            accountId: null,
            goalId: bill?.goalId ?? null,
            startsOn: bill?.startsOn ?? today(),
            endsOn: bill?.endsOn ?? null,
            installmentsTotal: parseInstallments(installments),
            active: true,
          });
        }}
      >
        <Field label={t("planner.name")}>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label={t("planner.amount")}>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
        </Field>
        <Field label={t("planner.dueDay")}>
          <input type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} />
        </Field>
        <Field label={t("planner.category")}>
          <select value={categoryId ?? ""} onChange={(event) => setCategoryId(event.target.value === "" ? null : Number(event.target.value))}>
            <option value="">{t("ledger.noCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("planner.installmentsTotal")}>
          <input
            type="number"
            min={2}
            value={installments}
            placeholder={t("planner.installmentsHint")}
            onChange={(event) => setInstallments(event.target.value)}
          />
        </Field>
        <div className="dialog-actions">
          {bill && onDelete ? (
            <button type="button" className="ghost danger" onClick={() => onDelete(bill.id)}>
              {t("common.delete")}
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary">{t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function CardDialog({ card, accounts, onClose, onSave }: { card: CardMeta | null; accounts: { id: number; name: string }[]; onClose: () => void; onSave: (input: CardInput) => void }) {
  const { t } = useLanguage();
  const [accountId, setAccountId] = useState(card?.accountId ?? accounts[0]?.id ?? 0);
  const [brand, setBrand] = useState(card?.brand ?? "");
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [limit, setLimit] = useState(card ? (card.limitCents / 100).toFixed(2) : "");
  const [closingDay, setClosingDay] = useState(card?.closingDay ?? 5);
  const [dueDay, setDueDay] = useState(card?.dueDay ?? 12);
  const [color, setColor] = useState(card?.color ?? "#2b2b2d");

  return (
    <Dialog title={t("planner.cardTitle")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: card?.id ?? null,
            accountId,
            brand: brand.trim(),
            last4: last4.slice(-4),
            limitCents: parseCents(limit),
            closingDay,
            dueDay,
            color,
            texture: card?.texture ?? "plain",
          });
        }}
      >
        <Field label={t("planner.account")}>
          <select value={accountId} onChange={(event) => setAccountId(Number(event.target.value))}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("planner.brand")}>
          <input value={brand} onChange={(event) => setBrand(event.target.value)} />
        </Field>
        <Field label={t("planner.last4")}>
          <input value={last4} onChange={(event) => setLast4(event.target.value)} maxLength={4} inputMode="numeric" />
        </Field>
        <Field label={t("planner.limit")}>
          <input value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label={t("planner.closingDay")}>
          <input type="number" min={1} max={31} value={closingDay} onChange={(event) => setClosingDay(Number(event.target.value))} />
        </Field>
        <Field label={t("planner.dueDay")}>
          <input type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(Number(event.target.value))} />
        </Field>
        <Field label={t("planner.color")}>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </Field>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary">{t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function GoalDialog({ goal, onClose, onSave }: { goal: Goal | null; onClose: () => void; onSave: (input: GoalInput) => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? (goal.targetCents / 100).toFixed(2) : "");
  const [monthly, setMonthly] = useState(goal ? (goal.monthlyCents / 100).toFixed(2) : "");
  const [color, setColor] = useState(goal?.color ?? "#8a6a2f");

  return (
    <Dialog title={t("planner.goalTitle")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: goal?.id ?? null,
            name: name.trim() || t("planner.goalTitle"),
            kind: goal?.kind ?? "reserve",
            targetCents: parseCents(target),
            monthlyCents: parseCents(monthly),
            startsOn: goal?.startsOn ?? today(),
            accountId: null,
            color,
          });
        }}
      >
        <Field label={t("planner.name")}>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label={t("planner.target")}>
          <input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" required />
        </Field>
        <Field label={t("planner.monthly")}>
          <input value={monthly} onChange={(event) => setMonthly(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label={t("planner.color")}>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </Field>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary">{t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function DepositDialog({ goal, onClose, onSave }: { goal: Goal; onClose: () => void; onSave: (input: DepositInput) => void }) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());

  return (
    <Dialog title={t("deposit.title", { name: goal.name })} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const cents = parseCents(amount);
          if (cents <= 0) return;
          onSave({ id: null, goalId: goal.id, amountCents: cents, depositedOn: date });
        }}
      >
        <Field label={t("planner.amount")}>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
        </Field>
        <Field label={t("manual.date")}>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary">{t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function BudgetDialog({
  name,
  budget,
  month,
  monthly,
  carryover,
  onClose,
  onSave,
}: {
  name: string;
  budget: number | null;
  month: string;
  monthly: number | null;
  carryover: boolean;
  onClose: () => void;
  onSave: (budget: number | null, monthly: number | null, carryover: boolean) => void;
}) {
  const { lang, t } = useLanguage();
  const [raw, setRaw] = useState(budget == null ? "" : (budget / 100).toFixed(2));
  const [monthRaw, setMonthRaw] = useState(monthly == null ? "" : (monthly / 100).toFixed(2));
  const [carry, setCarry] = useState(carryover);

  return (
    <Dialog title={t("budget.title", { name })} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          const base = raw.trim() === "" ? null : parseCents(raw);
          if (base !== null && base <= 0) return;
          const only = monthRaw.trim() === "" ? null : parseCents(monthRaw);
          if (only !== null && only <= 0) return;
          onSave(base, only, carry);
        }}
      >
        <Field label={t("planner.amount")}>
          <input
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            inputMode="decimal"
            placeholder={t("budget.none")}
          />
        </Field>
        <p className="muted small">{t("budget.hint")}</p>
        <Field label={`${t("budgets.monthly")} · ${monthLabel(month, lang)}`}>
          <input
            value={monthRaw}
            onChange={(event) => setMonthRaw(event.target.value)}
            inputMode="decimal"
            placeholder={t("budget.none")}
          />
        </Field>
        <p className="muted small">{t("budgets.monthlyHint", { month: monthLabel(month, lang) })}</p>
        <label className="check">
          <input type="checkbox" checked={carry} onChange={(event) => setCarry(event.target.checked)} />
          {t("budgets.carryover")}
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary">{t("common.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}
