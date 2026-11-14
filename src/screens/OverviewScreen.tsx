import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CompositionBar } from "../components/CompositionBar";
import { BreakdownBar } from "../components/BreakdownBar";
import { BalanceLine } from "../components/charts/BalanceLine";
import { Icon3D } from "../components/Icon3D";
import { AnchorCard, IconBubble } from "../components/editorial";
import { Icon } from "../components/Icons";
import { Money } from "../components/Money";
import { BillsCard, CardsCard, GoalsCard, HousingCard, SplitCard } from "../components/PlannerCards";
import { KpisCard } from "../components/KpiCards";
import { InstallmentsCard } from "../components/InstallmentsCard";
import { DebtsCard } from "../components/DebtsCard";
import { ScoreCard } from "../components/ScoreCard";
import type { InvoiceWindow } from "../domain/invoice";
import {
  isCardAvailable,
  moveCardNear,
  placeCard,
  resolveColumns,
  GRID_COLUMNS,
  setSpan,
  setHeight,
  HEIGHT_CARDS,
  MIN_CARD_HEIGHT,
  MAX_CARD_HEIGHT,
  CARD_SPANS,
  spanOptions,
  type CardId,
  type CardMode,
  type LayoutCard,
  type Span,
} from "../domain/layout";
import type { MonthPlan } from "../domain/projection";
import { formatCents, formatDate, monthLabel, monthShort, shiftMonth } from "../lib/format";
import { categoryName } from "../lib/i18n";
import { useLanguage } from "../lib/language";
import type {
  Bill,
  CardMeta,
  CategoryMonth,
  CategoryTotal,
  Debt,
  MonthPoint,
  Person,
  Share,
  TransactionRow,
} from "../lib/api";

/**
 * Where the dragged card would land. The rectangles are taken when the drag
 * starts, so the answer does not change when the preview moves the cards under
 * the pointer.
 */
type Landing = { id: CardId; side: "before" | "after" };

/**
 * Where a dragged card would land: on the half of a card the pointer is over,
 * or after the last card when the pointer is below the whole grid.
 */
function cardAt(
  x: number,
  y: number,
  cells: { id: CardId; rect: DOMRect }[],
  dragged: CardId,
): Landing | null {
  for (const cell of cells) {
    if (cell.id === dragged) continue;
    const { rect } = cell;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return { id: cell.id, side: y > rect.top + rect.height / 2 ? "after" : "before" };
    }
  }
  const others = cells.filter((cell) => cell.id !== dragged);
  const last = others[others.length - 1];
  if (!last) return null;
  const left = Math.min(...cells.map((cell) => cell.rect.left));
  const right = Math.max(...cells.map((cell) => cell.rect.right));
  const bottom = Math.max(...cells.map((cell) => cell.rect.bottom));
  if (x >= left && x <= right && y > bottom && y < bottom + 160) return { id: last.id, side: "after" };
  return null;
}

interface CardResizeState {
  id: CardId;
  pointerId: number;
  /** Left edge of the card, so the width follows the pointer wherever the drag started. */
  cellLeft: number;
  columnWidth: number;
  columnGap: number;
  minSpan: number;
  maxSpan: number;
  span: Span;
  changed: boolean;
}

/**
 * The width a drag asks for, in columns. The span only changes once the edge is
 * 40% into the next column (or 40% back into the one it left), so a card does not
 * flicker between two widths while the pointer rests near the boundary.
 */
function spanForEdge(
  edge: number,
  current: number,
  columnWidth: number,
  columnGap: number,
  min: number,
  max: number,
): number {
  const columns = (edge + columnGap) / (columnWidth + columnGap);
  let span = current;
  while (span < max && columns >= span + 0.4) span += 1;
  while (span > min && columns <= span - 0.4) span -= 1;
  return span;
}

interface OverviewProps {
  plan: MonthPlan;
  cards: { meta: CardMeta; usageCents: number; window: InvoiceWindow }[];
  byCategory: CategoryTotal[];
  series: MonthPoint[];
  matrix: CategoryMonth[];
  /** The month's newest entries, unfiltered by the ledger's search, account or tag. */
  rows: TransactionRow[];
  month: string;
  onSelectMonth: (month: string) => void;
  onOpenLedger: () => void;
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
  debts: Debt[];
  splitSettled: boolean;
  trackSettlement?: boolean;
  onAssignShare: (billId: number, personId: number) => void;
  onSettle: () => void;
  onAddDebt: () => void;
  onToggleDebt: (id: number, settled: boolean) => void;
  layout: LayoutCard[];
  layoutEditing: boolean;
  onLayoutMoveTo: (id: CardId, targetId: CardId, side?: "before" | "after") => void;
  onLayoutSet: (next: LayoutCard[]) => void;
  onLayoutResize: (id: CardId, span: Span) => void;
  onLayoutHeight: (id: CardId, height: number | null) => void;
  onLayoutSpan: (id: CardId, span: number) => void;
  onLayoutMode: (id: CardId, mode: CardMode) => void;
  onLayoutResetCard: (id: CardId) => void;
  onLayoutReset: () => void;
  onLayoutDone: () => void;
  onEditIncome: () => void;
  onEditBudget: (category: { id: number; name: string; budget: number | null }) => void;
  housingCategoryId: number | null;
}

export function OverviewScreen({
  plan,
  cards,
  byCategory,
  series,
  matrix,
  rows,
  month,
  onSelectMonth,
  onOpenLedger,
  onToggleBill,
  onAddBill,
  onEditBill,
  onAddCard,
  onEditCard,
  onAddGoal,
  onEditHousing,
  onHousingScope,
  onEditIncome,
  onEditBudget,
  housingCategoryId,
  housingScope,
  people,
  shares,
  splitSettled,
  trackSettlement = true,
  onAssignShare,
  onSettle,
  debts,
  onAddDebt,
  onToggleDebt,
  layout,
  layoutEditing,
  onLayoutMoveTo,
  onLayoutSet,
  onLayoutResize,
  onLayoutHeight,
  onLayoutSpan,
  onLayoutMode,
  onLayoutReset,
  onLayoutResetCard,
  onLayoutDone,
}: OverviewProps) {
  const { lang, t } = useLanguage();
  const [dragId, setDragId] = useState<CardId | null>(null);
  const [dropId, setDropId] = useState<CardId | null>(null);
  const [dropSide, setDropSide] = useState<"before" | "after">("before");
  // The order shown while dragging: the dashboard rearranges itself as a preview
  // and only the drop commits it.
  const [preview, setPreview] = useState<LayoutCard[] | null>(null);
  const [donutHover, setDonutHover] = useState<number | null>(null);
  // The series card can be paged back in time without leaving the month.
  // The shift is stored with the month it applies to, so changing month resets it.
  const [seriesShiftState, setSeriesShiftState] = useState({ month, shift: 0 });
  const seriesShift = seriesShiftState.month === month ? seriesShiftState.shift : 0;
  const setSeriesShift = (update: (value: number) => number) =>
    setSeriesShiftState({ month, shift: update(seriesShift) });
  const dragCells = useRef<{ id: CardId; rect: DOMRect }[]>([]);
  // The layout being shown, which is the drag preview while a card moves.
  const shown = preview ?? layout;
  const spanOf = (id: CardId) => shown.find((entry) => entry.id === id)?.span ?? 1;
  const spending = byCategory.reduce((total, item) => total + item.totalCents, 0);
  // Biggest first, and the tail becomes one slice: a legend of twelve rows is a
  // list, not a chart. A wider card has room for more rows.
  const legendLimit = 5;
  const ranked = [...byCategory].sort((left, right) => right.totalCents - left.totalCents);
  // Over five, the legend keeps four rows and one "Other": five lines at most.
  const keep = ranked.length > legendLimit ? legendLimit - 1 : legendLimit;
  const topCategories = ranked.slice(0, keep);
  const restCents = ranked.slice(keep).reduce((total, item) => total + item.totalCents, 0);
  const donutSlices =
    ranked.length > legendLimit
      ? [
          ...topCategories.map((item) => ({
            categoryId: item.categoryId,
            name: categoryName(t, item.name),
            color: item.color,
            value: item.totalCents,
            budgetCents: item.budgetCents,
          })),
          { categoryId: null, name: t("ledger.otherCategories"), color: "var(--faint)", value: restCents, budgetCents: null },
        ]
      : topCategories.map((item) => ({
          categoryId: item.categoryId,
          name: categoryName(t, item.name),
          color: item.color,
          value: item.totalCents,
          budgetCents: item.budgetCents,
        }));
  const keptShare =
    plan.incomeCents > 0 ? Math.round((plan.forecastCents / plan.incomeCents) * 100) : 0;

  // Income against spending. A full-width card earns the whole year.
  const inoutMonths = series.slice(-(spanOf("inout") >= 3 ? 12 : 6));
  const inoutPeak = Math.max(
    ...inoutMonths.map((point) => Math.max(point.incomeCents, point.expenseCents)),
    1,
  );

  // The ledger arrives newest first; sort defensively and keep the head. The
  // card shows four entries and a link to the rest.
  const recentLimit = 4;
  const recent = [...rows]
    .sort((left, right) =>
      left.postedOn === right.postedOn ? right.id - left.id : left.postedOn < right.postedOn ? 1 : -1,
    )
    .slice(0, recentLimit);

  // Cards that the plan does not support stay out of the grid, and a card the
  // user took off the dashboard waits in the shelf until it is added back.
  const cardContext = { people: people.length, housingCents: plan.housingCents };
  const visible = shown.filter(
    (item) => item.mode !== "hidden" && isCardAvailable(item.id, cardContext),
  );
  // The grid packs the cards by measured height, so a card with a height of its
  // own never leaves a hole that the one below cannot fill.
  // Every card starts in a column of its own choosing, so a drop can name the
  // column and the card it goes above instead of a place in one long line.
  const cols = resolveColumns(visible);
  const baseVisible = layout.filter(
    (item) => item.mode !== "hidden" && isCardAvailable(item.id, cardContext),
  );
  const baseCols = resolveColumns(baseVisible);
  const shelved = layout.filter(
    (item) => item.mode === "hidden" && isCardAvailable(item.id, cardContext),
  );

  // A card that occupies more than one column has room to say more, so it does
  // instead of stretching the same content over a wider box.
  const isWide = (id: CardId) => spanOf(id) >= 2;

  // One column per month, one segment per category that spent that month.
  // Missing pairs spent nothing, so the matrix stays sparse and the card
  // fills the gaps with empty columns.
  const stackCount = isWide("series") ? 12 : 6;
  // Only the 12 months ending at `month` are loaded, so the window cannot page past them.
  const minSeriesShift = stackCount - 12;
  const seriesEnd = shiftMonth(month, Math.max(minSeriesShift, seriesShift));
  const stackMonths = Array.from({ length: stackCount }, (_, offset) =>
    shiftMonth(seriesEnd, offset - stackCount + 1),
  );
  const stacks = stackMonths.map((stackMonth) => {
    const slices = matrix
      .filter((entry) => entry.month === stackMonth)
      .sort((left, right) => right.totalCents - left.totalCents);
    return {
      month: stackMonth,
      slices,
      total: slices.reduce((sum, slice) => sum + slice.totalCents, 0),
    };
  });
  const stackPeak = Math.max(...stacks.map((stack) => stack.total), 1);
  const barsRef = useRef<HTMLDivElement>(null);
  // What the pointer rests on in the monthly bars: a whole month or one category of it.
  const [barTip, setBarTip] = useState<{ month: string; category: string | null; x: number; y: number } | null>(null);
  const aimBarTip = (element: Element, month: string, category: string | null) => {
    const host = barsRef.current?.getBoundingClientRect();
    if (!host) return;
    const box = element.getBoundingClientRect();
    setBarTip({ month, category, x: box.left + box.width / 2 - host.left, y: box.top - host.top });
  };
  const tipStack = barTip ? stacks.find((stack) => stack.month === barTip.month) : undefined;
  // Four categories carry the story; the long tail shares one quiet grey.
  const OTHERS = "__others";
  const topNames = (() => {
    const totals = new Map<string, number>();
    for (const stack of stacks) {
      for (const slice of stack.slices) totals.set(slice.name, (totals.get(slice.name) ?? 0) + slice.totalCents);
    }
    return [...totals].sort((left, right) => right[1] - left[1]).slice(0, 4).map(([name]) => name);
  })();
  const parts = stacks.map((stack) => {
    const top = topNames.flatMap((name) => stack.slices.filter((slice) => slice.name === name));
    const rest = stack.slices.filter((slice) => !topNames.includes(slice.name));
    const restCents = rest.reduce((sum, slice) => sum + slice.totalCents, 0);
    return [
      ...(restCents > 0
        ? [{ name: OTHERS, color: "var(--faint)", totalCents: restCents, count: rest.length }]
        : []),
      ...top.map((slice) => ({ name: slice.name, color: slice.color, totalCents: slice.totalCents, count: 1 })),
    ];
  });
  const stackLegend: Array<[string, string]> = [
    ...topNames.map((name): [string, string] => [
      name,
      stacks.flatMap((stack) => stack.slices).find((slice) => slice.name === name)?.color ?? "var(--faint)",
    ]),
    ...(parts.some((list) => list.some((part) => part.name === OTHERS)) ? [[OTHERS, "var(--faint)"] as [string, string]] : []),
  ];
  const tipIndex = barTip ? stacks.findIndex((stack) => stack.month === barTip.month) : -1;
  const tipSlice = tipIndex >= 0 ? parts[tipIndex].find((part) => part.name === barTip?.category) : undefined;
  const compact = (cents: number) =>
    new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

  const cardName = (id: CardId) =>
    ({
      kpis: t("kpi.title"),
      forecast: t("overview.forecast"),
      bills: t("planner.bills"),
      cards: t("planner.cards"),
      housing: t("planner.housing"),
      goals: t("planner.goals"),
      split: t("split.title"),
      donut: t("ledger.whereMoney"),
      series: t("ledger.lastSix"),
      installments: t("planner.installments"),
      debts: t("debts.title"),
      score: t("score.title"),
      inout: t("overview.inout"),
      recent: t("overview.recent"),
    })[id];

  const cells: Record<CardId, ReactNode> = {
    kpis: <KpisCard plan={plan} series={series} month={month} span={spanOf("kpis")} />,
    installments: <InstallmentsCard plan={plan} month={month} />,
    debts: <DebtsCard debts={debts} month={month} onToggleSettled={onToggleDebt} onAdd={onAddDebt} />,
    score: <ScoreCard plan={plan} />,
    forecast: (
      <AnchorCard>
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
          <Money cents={plan.forecastCents} className="account-value" variant="hero" />
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

        <div className="account-figure" aria-hidden="true">
          <Icon3D name="piggy" size={96} />
        </div>

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
      </AnchorCard>
    ),
    bills: <BillsCard plan={plan} people={people} housingCategoryId={housingCategoryId} onToggle={onToggleBill} onAdd={onAddBill} onEdit={onEditBill} />,
    cards: (
      <CardsCard
        cards={cards}
        month={month}
        onAdd={onAddCard}
        onEdit={onEditCard}
        span={spanOf("cards")}
      />
    ),
    housing: (
      <HousingCard
        plan={plan}
        scope={housingScope}
        onScope={onHousingScope}
        onEdit={onEditHousing}
        wide={isWide("housing")}
      />
    ),
    goals: <GoalsCard plan={plan} onAdd={onAddGoal} wide={isWide("goals")} />,
    split: (
      <SplitCard
        people={people}
        shares={shares}
        bills={plan.dueBills}
        settled={splitSettled}
        trackSettlement={trackSettlement}
        onAssign={onAssignShare}
        onSettle={onSettle}
      />
    ),
    donut: (
      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <IconBubble name="pie" size="sm" />
            <h2>{t("ledger.whereMoney")}</h2>
          </div>
          <span className="muted">{monthLabel(month, lang)}</span>
        </header>

        {byCategory.length === 0 ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <div className="breakdown">
            <div className="breakdown-figure">
              <strong>
                {donutHover != null && donutSlices[donutHover]
                  ? formatCents(donutSlices[donutHover].value)
                  : formatCents(spending)}
              </strong>
              <span className="muted small">
                {donutHover != null && donutSlices[donutHover]
                  ? donutSlices[donutHover].name
                  : t("ledger.spending")}
              </span>
            </div>
            <BreakdownBar items={donutSlices} active={donutHover} onActive={setDonutHover} />
            <ul className="legend">
              {donutSlices.map((slice, index) => {
                const over = slice.budgetCents != null && slice.value > slice.budgetCents;
                const row = (
                  <>
                    <span className="dot" style={{ background: slice.color }} />
                    <span className="legend-name">{slice.name}</span>
                    <span className={over ? "legend-value over" : "legend-value"}>
                      {formatCents(slice.value)}
                      {slice.budgetCents != null ? ` / ${formatCents(slice.budgetCents)}` : null}
                    </span>
                    <span className="legend-share">
                      {spending > 0 ? Math.round((slice.value / spending) * 100) : 0}%
                    </span>
                  </>
                );
                return (
                  <li
                    key={slice.name}
                    className={donutHover === index ? "legend-row active" : "legend-row"}
                    onPointerEnter={() => setDonutHover(index)}
                    onPointerLeave={() => setDonutHover(null)}
                  >
                    {slice.categoryId == null ? (
                      row
                    ) : (
                      <button
                        type="button"
                        className="legend-edit"
                        onClick={() =>
                          onEditBudget({
                            id: slice.categoryId as number,
                            name: slice.name,
                            budget: slice.budgetCents,
                          })
                        }
                        aria-label={t("budget.title", { name: slice.name })}
                      >
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>
    ),
    series: (
      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <IconBubble name="bars" size="sm" />
            <h2>{isWide("series") ? t("ledger.lastTwelve") : t("ledger.lastSix")}</h2>
          </div>
          <div className="card-nav">
            <button
              type="button"
              className="icon-button"
              onClick={() => setSeriesShift((value) => Math.max(minSeriesShift, value - 1))}
              aria-label={t("planner.previousMonth")}
              title={t("planner.previousMonth")}
              disabled={seriesShift <= minSeriesShift}
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="muted small">{monthLabel(seriesEnd, lang)}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setSeriesShift((value) => Math.min(0, value + 1))}
              aria-label={t("planner.nextMonth")}
              title={t("planner.nextMonth")}
              disabled={seriesShift === 0}
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </header>
        {stacks.every((stack) => stack.total === 0) ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <>
            <BalanceLine
              net={series.slice(-12).map((point) => point.incomeCents - point.expenseCents)}
              months={series.slice(-12).map((point) => point.month)}
            />
            <h3 className="chart-subtitle">{t("chart.spending")}</h3>
            <div
              className="bars spend-bars"
              ref={barsRef}
              data-focus={barTip?.category ? "" : undefined}
              onPointerLeave={() => setBarTip(null)}
            >
              {stacks.map((stack, stackIndex) => (
                <button
                  type="button"
                  className="bar-col"
                  key={stack.month}
                  onClick={() => onSelectMonth(stack.month)}
                  onPointerEnter={(event) => aimBarTip(event.currentTarget.querySelector(".bar-track") ?? event.currentTarget, stack.month, null)}
                  onFocus={(event) => aimBarTip(event.currentTarget.querySelector(".bar-track") ?? event.currentTarget, stack.month, null)}
                  onBlur={() => setBarTip(null)}
                  aria-current={stack.month === month}
                  aria-label={`${monthLabel(stack.month, lang)}: ${formatCents(stack.total)}`}
                >
                  <div className="bar-track">
                    {stack.total > 0 ? (
                      <span className="bar-value" style={{ bottom: `calc(${(stack.total / stackPeak) * 100}% + 10px)` }}>
                        {compact(stack.total)}
                      </span>
                    ) : null}
                    <div className="bar-stack">
                      {parts[stackIndex].map((slice) => (
                        <div
                          key={slice.name}
                          className={
                            barTip?.category === slice.name ? "bar-segment is-on" : "bar-segment"
                          }
                          onPointerEnter={(event) => {
                            event.stopPropagation();
                            aimBarTip(event.currentTarget, stack.month, slice.name);
                          }}
                          onPointerLeave={(event) => {
                            const track = event.currentTarget.closest(".bar-track");
                            if (track) aimBarTip(track, stack.month, null);
                          }}
                          style={{
                            height: `${Math.max(2, (slice.totalCents / stackPeak) * 100)}%`,
                            background: slice.color,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className={stack.month === month ? "bar-label current" : "bar-label"}>
                    {monthShort(stack.month, lang)}
                  </span>
                </button>
              ))}
              {barTip && tipStack ? (
                <span
                  className="chart-tip"
                  role="tooltip"
                  style={{
                    left: Math.min(
                      Math.max(barTip.x, 84),
                      (barsRef.current?.clientWidth ?? 0) - 84,
                    ),
                    top: barTip.y - 8,
                  }}
                >
                  <strong>{monthLabel(barTip.month, lang)}</strong>
                  {tipSlice ? (
                    <>
                      <span className="tip-row">
                        <i className="chart-swatch" style={{ background: tipSlice.color }} />
                        {tipSlice.name === OTHERS
                          ? t("chart.otherCats", { count: tipSlice.count })
                          : categoryName(t, tipSlice.name)}
                        <b>{formatCents(tipSlice.totalCents)}</b>
                      </span>
                      <span className="tip-row muted">
                        {t("chart.share")}
                        <b>
                          {tipStack.total > 0 ? Math.round((tipSlice.totalCents / tipStack.total) * 100) : 0}%
                        </b>
                      </span>
                    </>
                  ) : (
                    tipStack.slices.slice(0, 5).map((slice) => (
                      <span className="tip-row" key={slice.categoryId ?? slice.name}>
                        <i className="chart-swatch" style={{ background: slice.color }} />
                        {categoryName(t, slice.name)}
                        <b>{formatCents(slice.totalCents)}</b>
                      </span>
                    ))
                  )}
                  {!tipSlice && tipStack.slices.length > 5 ? (
                    <span className="tip-row muted">
                      {t("chart.others", { count: tipStack.slices.length - 5 })}
                    </span>
                  ) : null}
                  <span className="tip-row">
                    {t("chart.total")}
                    <b>{formatCents(tipStack.total)}</b>
                  </span>
                </span>
              ) : null}
            </div>
            <div className="stack-legend" aria-hidden="true">
              {stackLegend.map(([name, color]) => (
                <span key={name}>
                  <span className="dot" style={{ background: color }} />
                  {name === OTHERS ? t("chart.otherCatsShort") : categoryName(t, name)}
                </span>
              ))}
            </div>
          </>
        )}
      </article>
    ),
    inout: (
      <article className="card overview-chart">
        <header className="card-head">
          <div className="card-title">
            <IconBubble name="scale" size="sm" />
            <h2>{t("overview.inout")}</h2>
          </div>
          <span className="muted">
            {inoutMonths.length > 6 ? t("ledger.lastTwelve") : t("ledger.lastSix")}
          </span>
        </header>
        {inoutMonths.every((point) => point.incomeCents === 0 && point.expenseCents === 0) ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <>
            <div className="flow-bars">
              {inoutMonths.map((point) => (
                <button
                  type="button"
                  key={point.month}
                  className={point.month === month ? "flow-col current has-tip" : "flow-col has-tip"}
                  onClick={() => onSelectMonth(point.month)}
                  aria-current={point.month === month}
                  aria-label={`${monthLabel(point.month, lang)}: ${t("kpi.income")} ${formatCents(point.incomeCents)}, ${t("kpi.expense")} ${formatCents(point.expenseCents)}`}
                >
                  <span className="col-tip" role="tooltip">
                    <strong>{monthLabel(point.month, lang)}</strong>
                    <span className="tip-row">
                      <i className="chart-swatch" style={{ background: "var(--chart-line)" }} />
                      {t("kpi.income")}
                      <b>{formatCents(point.incomeCents)}</b>
                    </span>
                    <span className="tip-row">
                      <i className="chart-swatch" style={{ background: "var(--negative)" }} />
                      {t("kpi.expense")}
                      <b>{formatCents(point.expenseCents)}</b>
                    </span>
                    <span className="tip-row muted">
                      {t("chart.monthNet")}
                      <b className={point.incomeCents - point.expenseCents < 0 ? "negative" : "positive"}>
                        {formatCents(point.incomeCents - point.expenseCents)}
                      </b>
                    </span>
                  </span>
                  <span className="flow-pair">
                    <span
                      className="flow-bar in"
                      style={{ height: `${Math.max(2, (point.incomeCents / inoutPeak) * 100)}%` }}
                    />
                    <span
                      className="flow-bar out"
                      style={{ height: `${Math.max(2, (point.expenseCents / inoutPeak) * 100)}%` }}
                    />
                  </span>
                  <span className="flow-label">{monthShort(point.month, lang)}</span>
                </button>
              ))}
            </div>
            {(() => {
              const current = inoutMonths.find((point) => point.month === month);
              return current ? (
                <p className="flow-summary">
                  {t("overview.currentMonthFlow", {
                    month: monthLabel(month, lang),
                    income: formatCents(current.incomeCents),
                    expense: formatCents(current.expenseCents),
                  })}
                </p>
              ) : null;
            })()}
            <div className="flow-legend">
              <span>
                <i className="flow-swatch in" />
                {t("kpi.income")}
              </span>
              <span>
                <i className="flow-swatch out" />
                {t("kpi.expense")}
              </span>
            </div>
          </>
        )}
      </article>
    ),
    recent: (
      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <IconBubble name="receipt" size="sm" />
            <h2>{t("overview.recent")}</h2>
          </div>
          <span className="muted">{monthLabel(month, lang)}</span>
        </header>
        {recent.length === 0 ? (
          <p className="card-empty">{t("overview.recentEmpty")}</p>
        ) : (
          <ul className="recent-list">
            {recent.map((row) => (
              <li key={row.id} className="recent-row">
                <span className="dot" style={{ background: row.categoryColor ?? "var(--faint)" }} />
                <span className="recent-main">
                  <span className="recent-title">{row.merchant || row.description}</span>
                  <span className="recent-meta">
                    {(row.categoryName ? categoryName(t, row.categoryName) : null) ?? t("ledger.noCategory")} · {formatDate(row.postedOn)}
                  </span>
                </span>
                <span className={row.amountCents < 0 ? "recent-amount out" : "recent-amount in"}>
                  {formatCents(row.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {recent.length > 0 ? (
          <button type="button" className="card-link" onClick={onOpenLedger}>
            {t("overview.recentAll")}
          </button>
        ) : null}
      </article>
    ),
  };

  // Only the cards card has a block that can be hidden on its own.
  const leanCells: Partial<Record<CardId, ReactNode>> = {
    cards: <CardsCard cards={cards} month={month} onAdd={onAddCard} onEdit={onEditCard} lean />,
  };

  // The grid sizes its own rows: the tallest card sets the height of the row,
  // and every cell in it stretches to match.
  const gridRef = useRef<HTMLDivElement>(null);
  const previousPositions = useRef(new Map<CardId, DOMRect>());
  const drag = useRef<{
    id: CardId;
    pointerId: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const resize = useRef<CardResizeState | null>(null);
  const [resizingId, setResizingId] = useState<CardId | null>(null);
  const [resizeAxis, setResizeAxis] = useState<"width" | "height" | null>(null);

  // Last known scroll position of the page: by the time the packed grid
  // is measured the browser may already have clamped the live value.
  const lastScroll = useRef(0);
  useEffect(() => {
    const scroller = gridRef.current?.closest<HTMLElement>("main");
    if (!scroller) return;
    const onScroll = () => {
      lastScroll.current = scroller.scrollTop;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const GAP = 14;
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .grid-cell"));
    // Measuring while the rows are still one pixel tall would shrink the page and
    // clamp the scroll position to the top, so the position is put back.
    const scroller = grid.closest<HTMLElement>("main");
    const top = lastScroll.current;
    const fit = (cell: HTMLElement) => {
      cell.style.gridRowEnd = `span ${Math.ceil(cell.offsetHeight + GAP)}`;
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) fit(entry.target as HTMLElement);
    });
    for (const cell of cells) {
      fit(cell);
      observer.observe(cell);
    }
    if (scroller) scroller.scrollTop = top;
    return () => {
      observer.disconnect();
      for (const cell of cells) cell.style.gridRowEnd = "";
    };
  });

  // Dragging an edge must not select the page text.
  useEffect(() => {
    if (!resizingId) return;
    document.body.classList.add("is-layout-resizing");
    return () => document.body.classList.remove("is-layout-resizing");
  }, [resizingId]);
  const [resizeColumns, setResizeColumns] = useState(3);

  const dropKey = useRef("");

  // What the pointer means: a column and the card it goes above (or the end of
  // that column) on a wide grid, a place next to a card on a single column.
  type Drop =
    | { kind: "col"; col: number; beforeId: CardId | null; markId: CardId | null; markSide: "before" | "after" }
    | { kind: "near"; id: CardId; side: "before" | "after"; markId: CardId; markSide: "before" | "after" };

  const dropAt = (x: number, y: number, dragged: CardId): Drop | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const style = getComputedStyle(grid);
    const columns = style.gridTemplateColumns.split(" ").filter(Boolean).length;
    if (columns < GRID_COLUMNS) {
      const landing = cardAt(x, y, dragCells.current, dragged);
      return landing ? { kind: "near", ...landing, markId: landing.id, markSide: landing.side } : null;
    }
    const rect = grid.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top - 40 || y > rect.bottom + 200) return null;
    const gap = Number.parseFloat(style.columnGap) || 0;
    const width = (rect.width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    const draggedSpan = baseVisible.find((card) => card.id === dragged)?.span ?? 1;
    const hovered = Math.floor((x - rect.left) / (width + gap)) + 1;
    const col = Math.max(1, Math.min(hovered, GRID_COLUMNS - draggedSpan + 1));
    const occupants = dragCells.current
      .filter((cell) => {
        if (cell.id === dragged) return false;
        const start = baseCols.get(cell.id);
        const span = baseVisible.find((card) => card.id === cell.id)?.span ?? 1;
        return start !== undefined && start <= col + draggedSpan - 1 && start + span - 1 >= col;
      })
      .sort((a, b) => a.rect.top - b.rect.top);
    const before = occupants.find((cell) => y < cell.rect.top + cell.rect.height / 2);
    const last = occupants[occupants.length - 1];
    return {
      kind: "col",
      col,
      beforeId: before?.id ?? null,
      markId: before?.id ?? last?.id ?? null,
      markSide: before ? "before" : "after",
    };
  };

  const applyDrop = (drop: Drop, id: CardId): LayoutCard[] =>
    drop.kind === "col"
      ? placeCard(layout, baseCols, id, drop.col, drop.beforeId)
      : moveCardNear(layout, id, drop.id, drop.side);

  const snapshotDragCells = () =>
    Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-card]") ?? []).map((cell) => ({
      id: cell.dataset.card as CardId,
      rect: cell.getBoundingClientRect(),
    }));

  // The handle on the right edge changes the width. The height is not set by
  // hand: a card is as tall as what it has to show.
  const beginResize = (event: React.PointerEvent<HTMLButtonElement>, id: CardId) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add("is-layout-resizing");
    window.getSelection()?.removeAllRanges();
    const grid = gridRef.current;
    const cell = event.currentTarget.closest<HTMLElement>("[data-card]");
    const item = shown.find((entry) => entry.id === id);
    if (!grid || !cell || !item) return;

    const columns = Math.max(
      1,
      getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    const columnGap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
    const gridWidth = grid.getBoundingClientRect().width;
    const columnWidth = (gridWidth - columnGap * (columns - 1)) / columns;
    if (columnWidth <= 0) return;

    resize.current = {
      id,
      pointerId: event.pointerId,
      cellLeft: cell.getBoundingClientRect().left,
      columnWidth,
      columnGap,
      minSpan: CARD_SPANS[id].min,
      maxSpan: Math.min(CARD_SPANS[id].max, columns),
      span: item.span,
      changed: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeColumns(columns);
    setResizeAxis("width");
    setResizingId(id);
  };

  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = resize.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const span = spanForEdge(
      event.clientX - state.cellLeft,
      state.span,
      state.columnWidth,
      state.columnGap,
      state.minSpan,
      state.maxSpan,
    ) as Span;
    if (span === state.span) return;
    state.span = span;
    state.changed = true;
    setPreview(setSpan(layout, state.id, span));
  };

  const endResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const state = resize.current;
    resize.current = null;
    if (!state || state.pointerId !== event.pointerId) return;
    if (state.changed) onLayoutResize(state.id, state.span);
    setResizingId(null);
    setPreview(null);
  };

  // The bottom edge sets a height in pixels; a double click puts the card back to its content.
  const heightDrag = useRef<{ id: CardId; pointerId: number; startY: number; startHeight: number; height: number } | null>(null);

  const beginHeight = (event: React.PointerEvent<HTMLButtonElement>, id: CardId) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add("is-layout-resizing");
    window.getSelection()?.removeAllRanges();
    const cell = event.currentTarget.closest<HTMLElement>("[data-card]");
    if (!cell) return;
    const startHeight = cell.getBoundingClientRect().height;
    heightDrag.current = { id, pointerId: event.pointerId, startY: event.clientY, startHeight, height: startHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizeAxis("height");
    setResizingId(id);
  };

  const moveHeight = (event: React.PointerEvent<HTMLButtonElement>) => {
    const state = heightDrag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const height = Math.min(MAX_CARD_HEIGHT, Math.max(MIN_CARD_HEIGHT, state.startHeight + event.clientY - state.startY));
    if (Math.round(height) === Math.round(state.height)) return;
    state.height = height;
    setPreview(setHeight(layout, state.id, height));
  };

  const endHeight = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const state = heightDrag.current;
    heightDrag.current = null;
    if (!state || state.pointerId !== event.pointerId) return;
    if (Math.round(state.height) !== Math.round(state.startHeight)) onLayoutHeight(state.id, Math.round(state.height));
    setResizingId(null);
    setPreview(null);
  };

  const cancelResize = () => {
    resize.current = null;
    setResizingId(null);
    setPreview(null);
  };

  useEffect(() => {
    if (!dragId && !resizingId) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      drag.current = null;
      resize.current = null;
      setDragId(null);
      setDropId(null);
      setResizingId(null);
      setPreview(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [dragId, resizingId]);

  const layoutPositionKey = visible
    .map(({ id, span, mode }) => `${id}:${span}:${mode}:${cols.get(id) ?? 0}`)
    .join("|");

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const nextPositions = new Map<CardId, DOMRect>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const cell of grid.querySelectorAll<HTMLElement>("[data-card]")) {
      const id = cell.dataset.card as CardId;
      const rect = cell.getBoundingClientRect();
      const previous = previousPositions.current.get(id);
      if (previous && !reduceMotion && id !== dragId && id !== resizingId) {
        const x = previous.left - rect.left;
        const y = previous.top - rect.top;
        if (Math.abs(x) > 1 || Math.abs(y) > 1) {
          cell.animate(
            [
              { transform: `translate(${x}px, ${y}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          );
        }
      }
      nextPositions.set(id, rect);
    }
    previousPositions.current = nextPositions;
  }, [layoutPositionKey, dragId, resizingId]);

  // A window resize or sidebar collapse reflows the grid without a layout change;
  // refresh the saved positions so the next animation starts from where cards are.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(() => {
      const positions = new Map<CardId, DOMRect>();
      for (const cell of grid.querySelectorAll<HTMLElement>("[data-card]")) {
        positions.set(cell.dataset.card as CardId, cell.getBoundingClientRect());
      }
      previousPositions.current = positions;
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="screen overview">
      {layoutEditing ? (
        <div className="layout-bar">
          <div className="layout-bar-row">
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
          {shelved.length > 0 ? (
            <div className="layout-shelf">
              <span className="muted small">{t("layout.available")}</span>
              {shelved.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="shelf-chip"
                  onClick={() => onLayoutMode(item.id, "full")}
                >
                  <Icon name="plus" size={13} />
                  {cardName(item.id)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="planner-grid is-packed"
        ref={gridRef}
        onPointerLeave={() => setDropId(null)}
      >
        {resizingId && resizeAxis === "width" ? (
          <div className="resize-guides" aria-hidden="true">
            {Array.from({ length: resizeColumns }, (_, column) => (
              <span key={column} />
            ))}
          </div>
        ) : null}
        {visible.map((item) => {
          const span = item.span;
          const cellClass = [
            "grid-cell",
            `span-${span}`,
            dragId === item.id ? "is-dragging" : "",
            resizingId === item.id ? "is-resizing" : "",
            dropId === item.id ? "is-drop-target" : "",
            dropId === item.id && dropSide === "after" ? "is-drop-after" : "",
            item.height ? "has-height" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
          <div
            key={item.id}
            className={cellClass}
            style={
              {
                "--col": cols.get(item.id),
                "--span": item.span,
                ...(item.height ? { height: item.height } : {}),
              } as CSSProperties
            }
            data-card={item.id}
            onPointerDown={(event) => {
              // The webview hands system drags to Rust, so HTML5 drag events
              // never reach the page: the cards are moved with pointer events.
              if (!layoutEditing || event.button !== 0) return;
              const grip = (event.target as HTMLElement).closest(".cell-grip");
              const control = (event.target as HTMLElement).closest(
                "button, a, input, select, textarea, [role='button']",
              );
              if (control && !grip) return;
              drag.current = {
                id: item.id,
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                active: false,
              };
              dragCells.current = snapshotDragCells();
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const state = drag.current;
              if (!state || state.pointerId !== event.pointerId) return;
              if (!state.active) {
                if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < 6) return;
                state.active = true;
                setDragId(state.id);
              }
              const drop = dropAt(event.clientX, event.clientY, state.id);
              const key = drop ? JSON.stringify(drop) : "";
              if (drop && key !== dropKey.current) {
                dropKey.current = key;
                setDropId(drop.markId);
                setDropSide(drop.markSide);
                setPreview(applyDrop(drop, state.id));
              }
            }}
            onPointerUp={(event) => {
              const state = drag.current;
              drag.current = null;
              if (!state || state.pointerId !== event.pointerId) return;
              // The landing is read from where the pointer actually stopped, so
              // letting go over a gap or outside the grid cancels instead of
              // committing whatever was last hovered.
              const drop = state.active ? dropAt(event.clientX, event.clientY, state.id) : null;
              if (drop) {
                const next = applyDrop(drop, state.id);
                if (next !== layout) onLayoutSet(next);
              }
              dropKey.current = "";
              setDragId(null);
              setDropId(null);
              setPreview(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              resize.current = null;
              setDragId(null);
              setDropId(null);
              setResizingId(null);
              setPreview(null);
            }}
          >
            {item.id === "cards" && span === 1 &&
              leanCells[item.id] ? (
              leanCells[item.id]
            ) : (
              cells[item.id]
            )}
            {layoutEditing ? (
              <div className="cell-tools" role="group" aria-label={t("layout.tools", { name: cardName(item.id) })}>
                <button
                  type="button"
                  className="cell-grip"
                  aria-label={t("layout.drag", { name: cardName(item.id) })}
                  title={t("layout.dragHint")}
                  onKeyDown={(event) => {
                    const col = cols.get(item.id) ?? 1;
                    const stack = visible.filter((card) => cols.get(card.id) === col);
                    const at = stack.findIndex((card) => card.id === item.id);
                    const put = (to: number, beforeId: CardId | null) =>
                      onLayoutSet(placeCard(layout, baseCols, item.id, to, beforeId));
                    if (event.key === "ArrowUp" && stack[at - 1]) {
                      event.preventDefault();
                      put(col, stack[at - 1].id);
                    }
                    if (event.key === "ArrowDown" && stack[at + 1]) {
                      event.preventDefault();
                      put(col, stack[at + 2]?.id ?? null);
                    }
                    if (event.key === "ArrowLeft" && col > 1) {
                      event.preventDefault();
                      put(col - 1, null);
                    }
                    if (event.key === "ArrowRight" && col + item.span - 1 < GRID_COLUMNS) {
                      event.preventDefault();
                      put(col + 1, null);
                    }
                    if (event.key === "Home" && visible[0]) {
                      event.preventDefault();
                      onLayoutMoveTo(item.id, visible[0].id);
                    }
                    if (event.key === "End" && visible[visible.length - 1]) {
                      event.preventDefault();
                      onLayoutMoveTo(item.id, visible[visible.length - 1].id);
                    }
                  }}
                >
                  <Icon name="grip" size={18} />
                </button>
                <span className="cell-tools-sep" aria-hidden="true" />
                {spanOptions(item.id).length < 2 ? null : (
                  <>
                    <span className="cell-spans" role="group" aria-label={t("layout.width")}>
                      {spanOptions(item.id).map((span) => (
                        <button
                          key={span}
                          type="button"
                          className={item.span === span ? "cell-span active" : "cell-span"}
                          aria-label={t("layout.widthOf", { span })}
                          aria-pressed={item.span === span}
                          title={t("layout.widthOf", { span })}
                          onClick={() => onLayoutSpan(item.id, span)}
                        >
                          {span}
                        </button>
                      ))}
                    </span>
                    <span className="cell-tools-sep" aria-hidden="true" />
                  </>
                )}
                <button
                  type="button"
                  className="cell-reset"
                  aria-label={t("layout.resetCard")}
                  title={t("layout.resetCard")}
                  onClick={() => onLayoutResetCard(item.id)}
                >
                  <Icon name="reset" size={14} />
                </button>
                <span className="cell-tools-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="cell-remove"
                  aria-label={t("layout.remove")}
                  title={t("layout.remove")}
                  onClick={() => onLayoutMode(item.id, "hidden")}
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ) : null}
            {layoutEditing && HEIGHT_CARDS.includes(item.id) ? (
              <button
                type="button"
                className="cell-resize-handle is-bottom"
                aria-label={t("layout.resizeHeight", { name: cardName(item.id) })}
                title={t("layout.resizeHeightHint")}
                onMouseDown={(event) => event.preventDefault()}
                onPointerDown={(event) => beginHeight(event, item.id)}
                onPointerMove={moveHeight}
                onPointerUp={endHeight}
                onPointerCancel={() => {
                  heightDrag.current = null;
                  setResizingId(null);
                  setPreview(null);
                }}
                onDoubleClick={() => onLayoutHeight(item.id, null)}
              />
            ) : null}
            {layoutEditing && spanOptions(item.id).length > 1 ? (
              <button
                type="button"
                className="cell-resize-handle is-right"
                aria-label={t("layout.resizeWidth", { name: cardName(item.id) })}
                title={t("layout.resizeWidth", { name: cardName(item.id) })}
                onMouseDown={(event) => event.preventDefault()}
                onPointerDown={(event) => beginResize(event, item.id)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={cancelResize}
              >
                {resizingId === item.id ? (
                  <span className="resize-badge">
                    {span}/{resizeColumns}
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
          );
        })}
      </div>
    </section>
  );
}
