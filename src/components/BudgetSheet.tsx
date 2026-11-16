import { StatTiles } from "./charts/ChartParts";
import { SortHeader } from "./SortHeader";
import { nextSort, sortRows, type SortState } from "../domain/sort";
import { useState } from "react";
import { Icon } from "./Icons";
import type { Bill, BillInput, BillPayment, Income, IncomeInput, Person, Share } from "../lib/api";
import { formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";
import { isDueIn } from "../domain/projection";

/** Puts `items` in the saved order; anything not listed (a row added since) goes last, oldest first. */
export function applyOrder<T extends { id: number }>(items: readonly T[], saved: readonly number[]): T[] {
  const rank = new Map(saved.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.id - b.id);
}

/** The order after dragging `id` onto `targetId`: it takes the place of the row it lands on. */
export function moveId(ids: readonly number[], id: number, targetId: number): number[] {
  const from = ids.indexOf(id);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = ids.filter((value) => value !== id);
  next.splice(next.indexOf(targetId) + (from < to ? 1 : 0), 0, id);
  return next;
}

/** An input that keeps its own text and saves once, on blur or Enter, only if it changed. */
export function EditCell({ value, onCommit, label, className, color }: { value: string; onCommit: (next: string) => void; label: string; className?: string; color?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
    setDraft(null);
  };
  return (
    <input
      className={`sheet-input ${className ?? ""}`}
      style={color ? { color } : undefined}
      value={draft ?? value}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
    />
  );
}

/** The input that saves a bill again with some fields changed. */
export const billToInput = (bill: Bill, patch: Partial<BillInput>): BillInput => ({
  id: bill.id,
  name: bill.name,
  amountCents: bill.amountCents,
  dueDay: bill.dueDay,
  frequency: bill.frequency,
  categoryId: bill.categoryId,
  accountId: bill.accountId,
  goalId: bill.goalId,
  startsOn: bill.startsOn,
  endsOn: bill.endsOn,
  installmentsTotal: bill.installmentsTotal,
  active: bill.active,
  ...patch,
});

/** "1.234,56", "1234,56" and "1234.56" all mean the same amount; anything else is not a number. */
export function parseCents(text: string): number | null {
  const clean = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(clean)) return null;
  const normal = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normal);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

export const plain = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/**
 * The month as a budget: income sources on the left, then every bill due this month with
 * whether it was paid, and the totals. It reads the same bills and payments as the
 * Overview, so ticking "paid" here ticks it there.
 */
export function BudgetSheet({
  month,
  incomes,
  bills,
  payments,
  incomeCents,
  people,
  shares,
  partnerMode,
  onAssignBill,
  order,
  onOrder,
  onTogglePaid,
  onSaveIncome,
  onEditIncome,
  onSaveBill,
  onEditBill,
}: {
  month: string;
  incomes: Income[];
  bills: Bill[];
  payments: BillPayment[];
  /** Total income the plan uses for the month (falls back to the statement when no income is set). */
  incomeCents: number;
  people: Person[];
  shares: Share[];
  /** When on, every income and expense says whose it is. */
  partnerMode: boolean;
  onAssignBill: (billId: number, personId: number) => void;
  /** Row order the person chose by dragging, by id. */
  order: { bills: number[]; incomes: number[] };
  onOrder: (kind: "bills" | "incomes", ids: number[]) => void;
  onTogglePaid: (billId: number, paid: boolean) => void;
  onSaveIncome: (input: IncomeInput) => void;
  onEditIncome: (income: Income) => void;
  onSaveBill: (input: BillInput) => void;
  onEditBill: (bill: Bill) => void;
}) {
  const { t } = useLanguage();
  // No sort key means creation order, so a row added now always lands at the bottom.
  const [incomeSort, setIncomeSort] = useState<SortState>({ key: "", dir: "asc" });
  const [billSort, setBillSort] = useState<SortState>({ key: "", dir: "asc" });
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  // A row can only be dragged by its grip, so typing in a cell never starts a drag.
  const [armed, setArmed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dragProps = (kind: "bills" | "incomes", id: number, ids: number[]) => {
    const key = `${kind}:${id}`;
    return {
      draggable: armed === key,
      onDragStart: (event: React.DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", key);
        setDragging(key);
      },
      onDragOver: (event: React.DragEvent) => {
        if (dragging?.startsWith(`${kind}:`) !== true) return;
        event.preventDefault();
        setOver(key);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const from = dragging?.startsWith(`${kind}:`) ? Number(dragging.split(":")[1]) : null;
        if (from !== null && from !== id) {
          onOrder(kind, moveId(ids, from, id));
          (kind === "bills" ? setBillSort : setIncomeSort)({ key: "", dir: "asc" });
        }
        setDragging(null);
        setOver(null);
        setArmed(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
        setArmed(null);
      },
      className: [dragging === key ? "is-dragging" : "", over === key && dragging !== key ? "is-over" : ""].filter(Boolean).join(" ") || undefined,
    };
  };
  const tint = (personId: number | null | undefined) => (partnerMode ? people.find((person) => person.id === personId)?.color : undefined);
  const billTint = (billId: number) => tint(shares.find((entry) => entry.billId === billId)?.personId);
  const grip = (kind: "bills" | "incomes", id: number, name: string) => (
    <td className="budget-grip">
      <span
        role="button"
        tabIndex={-1}
        className="grip"
        title={t("budget.drag")}
        aria-label={`${t("budget.drag")}: ${name}`}
        onMouseDown={() => setArmed(`${kind}:${id}`)}
        onMouseUp={() => setArmed(null)}
      >
        <Icon name="grip" size={14} />
      </span>
    </td>
  );
  const dueByDay = bills.filter((bill) => isDueIn(bill, month)).sort((a, b) => a.dueDay - b.dueDay);
  const due = applyOrder(dueByDay, order.bills);
  const paidOf = new Map(payments.filter((payment) => payment.month === month).map((payment) => [payment.billId, payment.amountCents]));
  const incomeInput = (income: Income, patch: Partial<IncomeInput>): IncomeInput => ({
    id: income.id,
    name: income.name,
    amountCents: income.amountCents,
    frequency: income.frequency,
    payDay: income.payDay,
    accountId: income.accountId,
    active: income.active,
    personId: income.personId,
    ...patch,
  });
  const billInput = (bill: Bill, patch: Partial<BillInput>): BillInput => ({
    id: bill.id,
    name: bill.name,
    amountCents: bill.amountCents,
    dueDay: bill.dueDay,
    frequency: bill.frequency,
    categoryId: bill.categoryId,
    accountId: bill.accountId,
    goalId: bill.goalId,
    startsOn: bill.startsOn,
    endsOn: bill.endsOn,
    installmentsTotal: bill.installmentsTotal,
    active: bill.active,
    ...patch,
  });
  const addIncome = () =>
    onSaveIncome({ id: null, name: t("budget.newIncome"), amountCents: 0, frequency: "monthly", payDay: 5, accountId: null, active: true, personId: null });
  const addBill = () =>
    onSaveBill({
      id: null,
      name: t("budget.newBill"),
      amountCents: 0,
      dueDay: Math.min(28, new Date().getDate()),
      frequency: "monthly",
      categoryId: null,
      accountId: null,
      goalId: null,
      startsOn: `${month}-01`,
      endsOn: null,
      installmentsTotal: null,
      active: true,
    });
  const sources = applyOrder(incomes.filter((income) => income.active), order.incomes);
  const expenses = due.reduce((sum, bill) => sum + bill.amountCents, 0);
  const paid = due.reduce((sum, bill) => sum + (paidOf.get(bill.id) ?? 0), 0);
  const paidCount = due.filter((bill) => paidOf.has(bill.id)).length;
  const paidPct = expenses > 0 ? Math.min(100, Math.round((paid / expenses) * 100)) : 0;
  const unpaid = dueByDay.filter((bill) => !paidOf.has(bill.id));
  const shownIncomes = sortRows(sources, incomeSort, (income, key) => (key === "name" ? income.name : key === "value" ? income.amountCents : null));
  const shownBills = sortRows(
    due.filter((bill) => filter === "all" || (filter === "paid") === paidOf.has(bill.id)),
    billSort,
    (bill, key) => (key === "name" ? bill.name : key === "value" ? bill.amountCents : key === "paid" ? paidOf.get(bill.id) ?? 0 : null),
  );
  const biggest = due.reduce<Bill | null>((top, bill) => (top === null || bill.amountCents > top.amountCents ? bill : top), null);

  return (
    <div className="budget">
      <StatTiles
        items={[
          { label: t("budget.totalIncome"), value: formatCents(incomeCents) },
          { label: t("budget.totalExpenses"), value: formatCents(expenses) },
          { label: t("budget.paidExpenses"), value: formatCents(paid) },
          { label: t("budget.balance"), value: formatCents(incomeCents - paid) },
          { label: t("budget.expected"), value: formatCents(incomeCents - expenses) },
        ]}
      />
      <div className={partnerMode ? "budget-tables partner" : "budget-tables"}>
        <div className="budget-side">
        <article className="card sheet-card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("budget.income")}</h2>
            </div>
            <button type="button" className="primary" onClick={addIncome}>
              <Icon name="plus" size={16} />
              {t("budget.addIncome")}
            </button>
          </header>
          <div className="sheet-wrap">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th aria-hidden="true" className="budget-grip" />
                  <SortHeader id="name" className="typed" label={t("budget.item")} sort={incomeSort} onSort={(key) => setIncomeSort((current) => nextSort(current, key))} />
                  <SortHeader id="value" className="typed" label={t("budget.value")} sort={incomeSort} onSort={(key) => setIncomeSort((current) => nextSort(current, key))} />
                  {partnerMode ? <th className="typed">{t("budget.person")}</th> : null}
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {shownIncomes.map((income) => (
                  <tr key={income.id} {...dragProps("incomes", income.id, sources.map((entry) => entry.id))}>
                    {grip("incomes", income.id, income.name)}
                    <td>
                      <EditCell color={tint(income.personId)} label={t("budget.item")} value={income.name} onCommit={(name) => name && onSaveIncome(incomeInput(income, { name }))} />
                    </td>
                    <td className="num">
                      <EditCell
                        className="num"
                        color={tint(income.personId)}
                        label={`${t("budget.value")}: ${income.name}`}
                        value={plain(income.amountCents)}
                        onCommit={(text) => {
                          const cents = parseCents(text);
                          if (cents !== null) onSaveIncome(incomeInput(income, { amountCents: cents }));
                        }}
                      />
                    </td>
                    {partnerMode ? (
                      <td>
                        <select
                          className="sheet-input person-select"
                          style={(() => { const color = people.find((person) => person.id === income.personId)?.color; return color ? { borderLeft: `4px solid ${color}`, color } : undefined; })()}
                          aria-label={`${t("budget.person")}: ${income.name}`}
                          value={income.personId ?? ""}
                          onChange={(event) => onSaveIncome(incomeInput(income, { personId: event.target.value ? Number(event.target.value) : null }))}
                        >
                          <option value="">{t("budget.noPerson")}</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.isSelf ? t("people.you") : person.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                    <td className="budget-actions">
                      <button type="button" className="icon-button" title={t("common.edit")} aria-label={`${t("common.edit")}: ${income.name}`} onClick={() => onEditIncome(income)}>
                        <Icon name="pencil" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan={partnerMode ? 5 : 4} className="muted">
                      {t("budget.noIncome")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card sheet-card budget-status">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("budget.status")}</h2>
            </div>
          </header>
          <div className="budget-meter" role="img" aria-label={`${paidPct}%`}>
            <i style={{ width: `${paidPct}%` }} />
          </div>
          <p className="muted small">{t("budget.paidOf", { paid: String(paidCount), total: String(due.length) })}</p>
          <dl className="budget-facts">
            <div>
              <dt>{t("budget.pending")}</dt>
              <dd>{formatCents(expenses - paid)}</dd>
            </div>
            <div>
              <dt>{t("budget.committed")}</dt>
              <dd>{incomeCents > 0 ? `${Math.round((expenses / incomeCents) * 100)}%` : "—"}</dd>
            </div>
            {biggest ? (
              <div>
                <dt>{t("budget.biggest")}</dt>
                <dd>
                  {biggest.name}
                  <small> {formatCents(biggest.amountCents)}</small>
                </dd>
              </div>
            ) : null}
          </dl>
          <h3 className="budget-subtitle">{t("budget.toPay")}</h3>
          <div className="budget-pending">
            <ul>
              {unpaid.map((bill) => (
                <li key={bill.id}>
                  <span className="budget-day">{String(bill.dueDay).padStart(2, "0")}</span>
                  <span className="budget-pending-name">{bill.name}</span>
                  <strong>{formatCents(bill.amountCents)}</strong>
                </li>
              ))}
              {unpaid.length === 0 ? <li className="muted">{t("budget.allPaid")}</li> : null}
            </ul>
          </div>
        </article>
        </div>

        <article className="card sheet-card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("budget.expenses")}</h2>
            </div>
            <div className="segmented sheet-seg budget-filter" role="tablist" aria-label={t("budget.filter")}>
              {(["all", "pending", "paid"] as const).map((id) => (
                <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "active" : undefined} onClick={() => setFilter(id)}>
                  {t(`budget.filter_${id}`)}
                </button>
              ))}
            </div>
            <button type="button" className="primary" onClick={addBill}>
              <Icon name="plus" size={16} />
              {t("budget.addBill")}
            </button>
          </header>
          <div className="sheet-wrap">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th aria-hidden="true" className="budget-grip" />
                  <SortHeader id="name" className="typed" label={t("budget.item")} sort={billSort} onSort={(key) => setBillSort((current) => nextSort(current, key))} />
                  <SortHeader id="value" className="typed" label={t("budget.value")} sort={billSort} onSort={(key) => setBillSort((current) => nextSort(current, key))} />
                  {partnerMode ? <th className="typed">{t("budget.person")}</th> : null}
                  <SortHeader id="paid" className="typed" label={t("budget.paid")} sort={billSort} onSort={(key) => setBillSort((current) => nextSort(current, key))} />
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {shownBills.map((bill) => {
                  const paidCents = paidOf.get(bill.id);
                  const isPaid = paidCents !== undefined;
                  return (
                    <tr key={bill.id} {...dragProps("bills", bill.id, due.map((entry) => entry.id))} className={[isPaid ? "is-paid" : "", dragProps("bills", bill.id, []).className ?? ""].filter(Boolean).join(" ") || undefined}>
                      {grip("bills", bill.id, bill.name)}
                      <td>
                        <EditCell color={billTint(bill.id)} label={t("budget.item")} value={bill.name} onCommit={(name) => name && onSaveBill(billInput(bill, { name }))} />
                      </td>
                      <td className="num">
                        <EditCell
                          className="num"
                          color={billTint(bill.id)}
                          label={`${t("budget.value")}: ${bill.name}`}
                          value={plain(bill.amountCents)}
                          onCommit={(text) => {
                            const cents = parseCents(text);
                            if (cents !== null) onSaveBill(billInput(bill, { amountCents: cents }));
                          }}
                        />
                      </td>
                      {partnerMode ? (
                        <td>
                          <select
                            className="sheet-input person-select"
                            style={(() => { const color = people.find((person) => person.id === shares.find((entry) => entry.billId === bill.id)?.personId)?.color; return color ? { borderLeft: `4px solid ${color}`, color } : undefined; })()}
                            aria-label={`${t("budget.person")}: ${bill.name}`}
                            value={shares.find((entry) => entry.billId === bill.id)?.personId ?? ""}
                            onChange={(event) => event.target.value && onAssignBill(bill.id, Number(event.target.value))}
                          >
                            <option value="" disabled>
                              —
                            </option>
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.isSelf ? t("people.you") : person.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      <td className="num">
                        <label className="budget-paid">
                          <input
                            type="checkbox"
                            checked={isPaid}
                            aria-label={`${t("budget.paid")}: ${bill.name}`}
                            onChange={(event) => onTogglePaid(bill.id, event.target.checked)}
                          />
                          <span>{isPaid ? formatCents(paidCents) : "—"}</span>
                        </label>
                      </td>
                      <td className="budget-actions">
                        <button type="button" className="icon-button" title={t("common.edit")} aria-label={`${t("common.edit")}: ${bill.name}`} onClick={() => onEditBill(bill)}>
                          <Icon name="pencil" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {due.length === 0 ? (
                  <tr>
                    <td colSpan={partnerMode ? 6 : 5} className="muted">
                      {t("budget.noBills")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </div>
  );
}
