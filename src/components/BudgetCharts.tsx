import { BarList, type BarListRow } from "./charts/BarList";
import { CrossBars, type CrossRow } from "./charts/ChartParts";
import { isDueIn } from "../domain/projection";
import type { Bill, BillPayment, Income, Person, Share } from "../lib/api";
import { formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";

const NONE = -1;

/**
 * What the budget says once it knows whose each income and expense is: how much each person
 * brings in, owes, has already paid and is left with. Shown only in partner mode.
 */
export function BudgetCharts({
  month,
  people,
  incomes,
  bills,
  payments,
  shares,
}: {
  month: string;
  people: Person[];
  incomes: Income[];
  bills: Bill[];
  payments: BillPayment[];
  shares: Share[];
}) {
  const { t } = useLanguage();
  const due = bills.filter((bill) => isDueIn(bill, month));
  const paidIds = new Set(payments.filter((payment) => payment.month === month).map((payment) => payment.billId));
  const selfId = (people.find((person) => person.isSelf) ?? people[0])?.id ?? NONE;
  const ownerOf = (billId: number) => shares.find((entry) => entry.billId === billId)?.personId ?? selfId;

  const name = (id: number) =>
    id === NONE ? t("budget.unassigned") : (people.find((person) => person.id === id)?.isSelf ? t("people.you") : (people.find((person) => person.id === id)?.name ?? "?"));
  const colorOf = (id: number) => people.find((person) => person.id === id)?.color ?? "#94a3b8";

  // One entry per person, plus "unassigned" only when something belongs to no one.
  const income = new Map<number, number>();
  const spend = new Map<number, number>();
  const paid = new Map<number, number>();
  for (const entry of incomes.filter((item) => item.active)) {
    const key = entry.personId ?? NONE;
    income.set(key, (income.get(key) ?? 0) + entry.amountCents);
  }
  for (const bill of due) {
    const key = ownerOf(bill.id);
    spend.set(key, (spend.get(key) ?? 0) + bill.amountCents);
    if (paidIds.has(bill.id)) paid.set(key, (paid.get(key) ?? 0) + bill.amountCents);
  }
  const keys = [...people.map((person) => person.id), ...(income.has(NONE) || spend.has(NONE) ? [NONE] : [])];

  const rows = (source: Map<number, number>): BarListRow[] =>
    keys
      .map((key) => ({ label: name(key), value: source.get(key) ?? 0, display: formatCents(source.get(key) ?? 0), color: colorOf(key) }))
      .sort((a, b) => b.value - a.value);

  const progress: CrossRow[] = keys.map((key) => ({
    label: name(key),
    parts: {
      [t("budget.chartPaid")]: paid.get(key) ?? 0,
      [t("budget.chartPending")]: (spend.get(key) ?? 0) - (paid.get(key) ?? 0),
    },
  }));

  const left: BarListRow[] = keys
    .map((key) => {
      const balance = (income.get(key) ?? 0) - (spend.get(key) ?? 0);
      const share = (income.get(key) ?? 0) > 0 ? Math.round(((spend.get(key) ?? 0) / (income.get(key) ?? 0)) * 100) : null;
      return {
        label: share === null ? name(key) : `${name(key)} · ${share}%`,
        value: balance,
        display: formatCents(balance),
        color: balance < 0 ? "#dc2626" : colorOf(key),
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="sheet-charts-grid">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("budget.chartIncome")}</h2>
            </div>
          </header>
          <BarList rows={rows(income)} label={t("budget.chartIncome")} />
        </article>
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("budget.chartExpenses")}</h2>
            </div>
          </header>
          <BarList rows={rows(spend)} label={t("budget.chartExpenses")} />
        </article>
      </div>
      <div className="sheet-charts-grid">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("budget.chartProgress")}</h2>
            </div>
          </header>
          <CrossBars rows={progress} others={t("transactions.sheet.others")} format={formatCents} label={t("budget.chartProgress")} />
        </article>
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2 title={t("budget.chartLeftHint")}>{t("budget.chartLeft")}</h2>
            </div>
          </header>
          <BarList rows={left} label={t("budget.chartLeft")} />
        </article>
      </div>
    </>
  );
}
