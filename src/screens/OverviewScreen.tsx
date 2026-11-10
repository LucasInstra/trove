import { useMemo } from "react";
import { CompositionBar } from "../components/CompositionBar";
import { Donut } from "../components/Donut";
import { Icon } from "../components/Icons";
import { BillsCard, CardsCard, GoalsCard, HousingCard } from "../components/PlannerCards";
import { TransactionsPanel } from "../components/TransactionsPanel";
import type { InvoiceWindow } from "../domain/invoice";
import type { MonthPlan } from "../domain/projection";
import { formatCents, formatSignedCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import type {
  Account,
  Bill,
  CardMeta,
  Category,
  CategoryTotal,
  MonthPoint,
  TransactionRow,
} from "../lib/api";

interface OverviewProps {
  plan: MonthPlan;
  cards: { meta: CardMeta; usageCents: number; window: InvoiceWindow }[];
  rows: TransactionRow[];
  categories: Category[];
  byCategory: CategoryTotal[];
  series: MonthPoint[];
  search: string;
  loading: boolean;
  month: string;
  onSearch: (value: string) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
  onSelectMonth: (month: string) => void;
  onToggleBill: (billId: number, paid: boolean) => void;
  onAddBill: () => void;
  onEditBill: (bill: Bill) => void;
  onAddCard: () => void;
  onEditCard: (card: CardMeta) => void;
  onAddGoal: () => void;
  onEditHousing: () => void;
  onEditIncome: () => void;
  accounts: Account[];
  accountFilter: number | null;
  onAccountFilter: (accountId: number | null) => void;
}

export function OverviewScreen({
  plan,
  cards,
  rows,
  categories,
  byCategory,
  series,
  search,
  loading,
  month,
  onSearch,
  onCategory,
  onImport,
  onSelectMonth,
  onToggleBill,
  onAddBill,
  onEditBill,
  onAddCard,
  onEditCard,
  onAddGoal,
  onEditHousing,
  onEditIncome,
  accounts,
  accountFilter,
  onAccountFilter,
}: OverviewProps) {
  const { lang, t } = useLanguage();
  const spending = byCategory.reduce((total, item) => total + item.totalCents, 0);
  const peak = Math.max(...series.slice(-6).map((point) => point.expenseCents), 1);
  const keptShare =
    plan.incomeCents > 0 ? Math.round((plan.forecastCents / plan.incomeCents) * 100) : 0;

  const groups = useMemo(() => {
    const map = new Map<string, { rows: TransactionRow[]; total: number }>();
    for (const row of rows) {
      const entry = map.get(row.postedOn) ?? { rows: [], total: 0 };
      entry.rows.push(row);
      entry.total += row.amountCents;
      map.set(row.postedOn, entry);
    }
    return [...map.entries()].map(([day, value]) => ({ day, ...value }));
  }, [rows]);

  return (
    <section className="screen overview">
      <div className="planner-grid">
        <div className="planner-col">
        <article className="account-card">
          <div className="account-top">
            <span className="account-label">{t("overview.forecast", { month: monthLabel(month, lang) })}</span>
            <button type="button" className="account-edit" onClick={onEditIncome} aria-label={t("overview.editIncome")}>
              <Icon name="settings" size={14} />
            </button>
          </div>

          <div className="account-value-row">
            <strong className="account-value">{formatSignedCents(plan.forecastCents)}</strong>
            {plan.incomeCents > 0 ? (
              <span className={plan.forecastCents >= 0 ? "account-badge" : "account-badge down"}>
                <Icon name="trend" size={13} />
                {plan.forecastCents >= 0
                  ? t("overview.keptShare", { percent: Math.abs(keptShare) })
                  : t("overview.overShare", { percent: Math.abs(keptShare) })}
              </span>
            ) : null}
          </div>

          <CompositionBar parts={plan.composition} lang={lang} format={formatCents} />

          <div className="account-bottom">
            <div className="account-inout">
              <span>{t("overview.income", { amount: formatCents(plan.incomeCents) })}</span>
              <span>{t("overview.committed", { amount: formatCents(plan.plannedCents || plan.realizedCents) })}</span>
            </div>
          </div>
        </article>

        <CardsCard cards={cards} onAdd={onAddCard} onEdit={onEditCard} />
        <GoalsCard plan={plan} onAdd={onAddGoal} />
        </div>

        <div className="planner-col">
        <BillsCard plan={plan} onToggle={onToggleBill} onAdd={onAddBill} onEdit={onEditBill} />
        <HousingCard plan={plan} onEdit={onEditHousing} />
        </div>

        <div className="planner-wide">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon violet"><Icon name="ledger" size={15} /></span>
              <h2>{t("ledger.whereMoney")}</h2>
            </div>
            <span className="muted">{monthLabel(month, lang)}</span>
          </header>

          {byCategory.length === 0 ? (
            <p className="card-empty">{t("ledger.noSpending")}</p>
          ) : (
            <div className="donut-row">
              <Donut segments={byCategory.map((item) => ({ color: item.color, value: item.totalCents }))} />
              <ul className="legend">
                {byCategory.map((item) => (
                  <li key={`${item.categoryId ?? "none"}-${item.name}`}>
                    <span className="dot" style={{ background: item.color }} />
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-value">{formatCents(item.totalCents)}</span>
                    <span className="legend-share">
                      {spending > 0 ? Math.round((item.totalCents / spending) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate"><Icon name="flow" size={15} /></span>
              <h2>{t("ledger.lastSix")}</h2>
            </div>
            <span className="muted">{t("ledger.spending")}</span>
          </header>
          <div className="bars">
            {series.slice(-6).map((point) => (
              <button
                type="button"
                className="bar-col"
                key={point.month}
                onClick={() => onSelectMonth(point.month)}
                aria-current={point.month === month}
                aria-label={`${monthLabel(point.month, lang)}: ${formatCents(point.expenseCents)}`}
              >
                <span className="bar-value">
                  {point.expenseCents > 0 ? formatCents(point.expenseCents) : ""}
                </span>
                <div className="bar-track">
                  <div
                    className={
                      point.expenseCents === 0
                        ? "bar blank"
                        : point.month === month
                          ? "bar current"
                          : "bar"
                    }
                    style={{
                      height:
                        point.expenseCents === 0
                          ? "0%"
                          : `${Math.max(3, (point.expenseCents / peak) * 100)}%`,
                    }}
                    title={`${monthLabel(point.month, lang)}: ${formatCents(point.expenseCents)}`}
                  />
                </div>
                <span className={point.month === month ? "bar-label current" : "bar-label"}>
                  {monthShort(point.month, lang)}
                </span>
              </button>
            ))}
          </div>
        </article>
        </div>
      </div>

      <TransactionsPanel
        rows={rows}
        categories={categories}
        search={search}
        loading={loading}
        onSearch={onSearch}
        onCategory={onCategory}
        onImport={onImport}
        groups={groups}
        accounts={accounts}
        accountFilter={accountFilter}
        onAccountFilter={onAccountFilter}
      />
    </section>
  );
}
