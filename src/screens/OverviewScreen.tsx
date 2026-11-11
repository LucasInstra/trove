import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { CardId, LayoutCard } from "../domain/layout";
import { rowSpanFor } from "../domain/packing";
import type { MonthPlan } from "../domain/projection";
import { computeSplit } from "../domain/split";
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
  layout: LayoutCard[];
  layoutEditing: boolean;
  onLayoutMove: (id: CardId, delta: number) => void;
  onLayoutResize: (id: CardId, delta: number) => void;
  onLayoutCollapse: (id: CardId) => void;
  onLayoutReset: () => void;
  onLayoutDone: () => void;
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
  layout,
  layoutEditing,
  onLayoutMove,
  onLayoutResize,
  onLayoutCollapse,
  onLayoutReset,
  onLayoutDone,
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

  const cardName = (id: CardId) =>
    ({
      forecast: t("overview.forecast"),
      bills: t("planner.bills"),
      cards: t("planner.cards"),
      housing: t("planner.housing"),
      goals: t("planner.goals"),
      split: t("split.title"),
      donut: t("ledger.whereMoney"),
      series: t("ledger.lastSix"),
    })[id];

  const collapsedFigure = (id: CardId): ReactNode => {
    switch (id) {
      case "forecast":
        return formatCents(plan.forecastCents);
      case "bills":
        return formatCents(plan.plannedCents);
      case "cards":
        return formatCents(cards[0]?.usageCents ?? 0);
      case "housing":
        return formatCents(plan.housingCents);
      case "goals": {
        const firstGoal = plan.goals[0];
        return firstGoal
          ? t("planner.goalProgress", { percent: Math.round(firstGoal.sharePct) })
          : t("layout.goalCount", { count: 0 });
      }
      case "split":
        return formatCents(computeSplit(people, shares, plan.dueBills).settlementCents);
      case "donut": {
        const biggest = byCategory[0];
        return biggest ? `${biggest.name} · ${formatCents(biggest.totalCents)}` : formatCents(0);
      }
      case "series":
        return formatCents(series.find((point) => point.month === month)?.expenseCents ?? 0);
    }
  };

  const cells: Record<CardId, ReactNode> = {
    forecast: (
      <article className="account-card">
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
    ),
    bills: <BillsCard plan={plan} onToggle={onToggleBill} onAdd={onAddBill} onEdit={onEditBill} />,
    cards: <CardsCard cards={cards} month={month} onAdd={onAddCard} onEdit={onEditCard} />,
    housing: (
      <HousingCard plan={plan} scope={housingScope} onScope={onHousingScope} onEdit={onEditHousing} />
    ),
    goals: <GoalsCard plan={plan} onAdd={onAddGoal} />,
    split: (
      <SplitCard
        people={people}
        shares={shares}
        bills={plan.dueBills}
        settled={splitSettled}
        onAssign={onAssignShare}
        onSettle={onSettle}
      />
    ),
    donut: (
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
    ),
    series: (
      <article className="card">
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
    ),
  };

  // Cards have very different heights, so they declare how many row units they
  // take and the grid packs them without the holes a fixed row height leaves.
  const ROW_UNIT = 4;
  const ROW_GAP = 14;
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowSpans, setRowSpans] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let frame = 0;

    const measure = () => {
      const next: Record<string, number> = {};
      for (const cell of grid.querySelectorAll<HTMLElement>("[data-card]")) {
        const id = cell.dataset.card ?? "";
        const card = cell.firstElementChild as HTMLElement | null;
        if (!id || !card) continue;
        next[id] = rowSpanFor(card.offsetHeight, ROW_UNIT, ROW_GAP);
      }
      setRowSpans((current) => {
        const keys = Object.keys(next);
        const stable =
          keys.length === Object.keys(current).length && keys.every((key) => current[key] === next[key]);
        return stable ? current : next;
      });
    };

    measure();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
      });
      observer.observe(grid);
      for (const cell of grid.querySelectorAll<HTMLElement>("[data-card]")) {
        const card = cell.firstElementChild;
        if (card) observer.observe(card);
      }
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [layout]);

  return (
    <section className="screen overview">
      {layoutEditing ? (
        <div className="layout-bar">
          <span className="muted small">{t("layout.hint")}</span>
          <div className="layout-actions">
            <button type="button" className="ghost small-button" onClick={onLayoutReset}>
              {t("layout.reset")}
            </button>
            <button type="button" className="primary small-button" onClick={onLayoutDone}>
              {t("layout.done")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="planner-grid" ref={gridRef}>
        {layout.map((item, index) => {
          // A card that is minimised becomes a chip one column wide, so it can
          // fill the single column holes the tall cards leave behind. Opening it
          // again brings back the width the user chose.
          const span = item.collapsed ? 1 : item.span;
          return (
          <div
            key={item.id}
            className={`grid-cell span-${span}${item.id === "bills" ? " natural" : ""}${item.collapsed ? " is-collapsed" : ""}`}
            data-card={item.id}
            style={{
              gridColumn: `span ${span}`,
              gridRowEnd: `span ${rowSpans[item.id] ?? 1}`,
            }}
          >
            {item.collapsed ? (
              <button
                type="button"
                className="collapsed-card"
                onClick={() => onLayoutCollapse(item.id)}
                title={t("layout.expand")}
                aria-label={`${cardName(item.id)} · ${t("layout.expand")}`}
              >
                <span className="collapsed-card-title">{cardName(item.id)}</span>
                <span className="collapsed-card-value">{collapsedFigure(item.id)}</span>
                <span className="collapse-trigger" aria-hidden="true">
                  <Icon name="chevron-down" size={16} />
                </span>
              </button>
            ) : (
              cells[item.id]
            )}
            {layoutEditing ? (
              <div className="cell-tools" role="group" aria-label={t("layout.tools", { name: cardName(item.id) })}>
                <button
                  type="button"
                  aria-label={t("layout.moveUp")}
                  disabled={index === 0}
                  onClick={() => onLayoutMove(item.id, -1)}
                >
                  <Icon name="chevron-up" size={14} />
                </button>
                <button
                  type="button"
                  aria-label={t("layout.moveDown")}
                  disabled={index === layout.length - 1}
                  onClick={() => onLayoutMove(item.id, 1)}
                >
                  <Icon name="chevron-down" size={14} />
                </button>
                <span className="cell-tools-sep" aria-hidden="true" />
                {item.collapsed ? null : (
                  <>
                    <button
                      type="button"
                      aria-label={t("layout.narrow")}
                      disabled={item.span <= 1}
                      onClick={() => onLayoutResize(item.id, -1)}
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={t("layout.widen")}
                      disabled={item.span >= 3}
                      onClick={() => onLayoutResize(item.id, 1)}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                    <span className="cell-tools-sep" aria-hidden="true" />
                  </>
                )}
                <button
                  type="button"
                  aria-label={item.collapsed ? t("layout.expand") : t("layout.collapse")}
                  title={item.collapsed ? t("layout.expand") : t("layout.collapse")}
                  onClick={() => onLayoutCollapse(item.id)}
                >
                  <Icon name={item.collapsed ? "chevron-down" : "chevron-up"} size={14} />
                </button>
              </div>
            ) : null}
          </div>
          );
        })}
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
