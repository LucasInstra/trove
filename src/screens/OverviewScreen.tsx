import { useMemo } from "react";
import { CompositionBar } from "../components/CompositionBar";
import { Donut } from "../components/Donut";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";
import { Money } from "../components/Money";
import { BillsCard, CardsCard, GoalsCard, HousingCard, SplitCard } from "../components/PlannerCards";
import { TransactionsPanel } from "../components/TransactionsPanel";
import type { InvoiceWindow } from "../domain/invoice";
import type { KeeperLook } from "../lib/keeper";
import { SHOW_HERO_KEEPER } from "../lib/features";
import type { MonthPlan } from "../domain/projection";
import { formatCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import type {
  Account,
  Bill,
  CardMeta,
  Category,
  CategoryTotal,
  MonthPoint,
  Person,
  Share,
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
  housingScope: "primary" | "total";
  onHousingScope: (scope: "primary" | "total") => void;
  people: Person[];
  shares: Share[];
  splitSettled: boolean;
  onAssignShare: (billId: number, personId: number) => void;
  onSettle: () => void;
  onEditIncome: () => void;
  accounts: Account[];
  look: KeeperLook;
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
  onHousingScope,
  onEditIncome,
  housingScope,
  people,
  shares,
  splitSettled,
  onAssignShare,
  onSettle,
  accounts,
  look,
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
        <article className="account-card span-2">
          <div className="account-top">
            <span className="account-label">{t("overview.forecast")}</span>
            <button
              type="button"
              className="account-edit"
              onClick={onEditIncome}
              aria-label={t("overview.editIncome")}
              title={t("overview.editIncome")}
            >
              <Icon name="settings" size={14} />
            </button>
          </div>

          <div className="account-main">
            <Money cents={plan.forecastCents} className="account-value" />
            {plan.incomeCents > 0 ? (
              <div className="account-delta">
                <span className={plan.forecastCents >= 0 ? "delta-line" : "delta-line down"}>
                  <Icon name="trend" size={14} />
                  {plan.forecastCents >= 0
                    ? t("overview.keptShare", { percent: Math.abs(keptShare) })
                    : t("overview.overShare", { percent: Math.abs(keptShare) })}
                </span>
                <span className="muted small">{t("overview.hint")}</span>
              </div>
            ) : null}
          </div>

          {SHOW_HERO_KEEPER ? (
            <div className="account-figure" aria-hidden="true">
              <Mascot look={look} size={112} animate={false} boopable={false} bare fps={30} />
            </div>
          ) : null}

          <CompositionBar parts={plan.composition} format={formatCents} />

          <div className="account-bottom">
            <span className="account-meta">
              {t("overview.income")} <strong>{formatCents(plan.incomeCents)}</strong>
            </span>
            <span className="account-meta">
              {t("overview.committed")}{" "}
              <strong>{formatCents(plan.plannedCents || plan.realizedCents)}</strong>
            </span>
          </div>
        </article>

        <BillsCard plan={plan} onToggle={onToggleBill} onAdd={onAddBill} onEdit={onEditBill} />
        <CardsCard cards={cards} month={month} onAdd={onAddCard} onEdit={onEditCard} />
        <HousingCard plan={plan} scope={housingScope} onScope={onHousingScope} onEdit={onEditHousing} />
        <GoalsCard plan={plan} onAdd={onAddGoal} />

        <SplitCard
          people={people}
          shares={shares}
          bills={plan.dueBills}
          settled={splitSettled}
          onAssign={onAssignShare}
          onSettle={onSettle}
        />

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

        <article className="card span-3">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate"><Icon name="flow" size={15} /></span>
              <h2>{t("ledger.lastSix")}</h2>
            </div>
            <span className="muted">{t("ledger.spending")}</span>
          </header>
          {series.every((point) => point.expenseCents === 0) ? (
            <p className="card-empty">{t("ledger.noSpending")}</p>
          ) : (
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
          )}
        </article>
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
