import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CompositionBar } from "../components/CompositionBar";
import { BreakdownBar } from "../components/BreakdownBar";
import { Donut } from "../components/Donut";
import { Icon3D } from "../components/Icon3D";
import { Progress } from "../components/ui/progress";
import { Icon, type IconName } from "../components/Icons";
import { Money } from "../components/Money";
import { BillsCard, CardsCard, GoalsCard, HousingCard, SplitCard } from "../components/PlannerCards";
import type { InvoiceWindow } from "../domain/invoice";
import {
  hasDetailsSection,
  isCardAvailable,
  moveCardTo,
  nextMode,
  type CardId,
  type CardMode,
  type LayoutCard,
} from "../domain/layout";
import { rowSpanFor } from "../domain/packing";
import type { MonthPlan } from "../domain/projection";
import { computeSplit } from "../domain/split";
import { formatCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import type { Bill, CardMeta, CategoryTotal, MonthPoint, Person, Share } from "../lib/api";

/**
 * Where the dragged card would land. The rectangles are taken when the drag
 * starts, so the answer does not change when the preview moves the cards under
 * the pointer.
 */
function cardAt(
  x: number,
  y: number,
  cells: { id: CardId; rect: DOMRect }[],
  dragged: CardId,
): CardId | null {
  for (const cell of cells) {
    if (cell.id === dragged) continue;
    const { rect } = cell;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return cell.id;
  }
  return null;
}

interface OverviewProps {
  plan: MonthPlan;
  cards: { meta: CardMeta; usageCents: number; window: InvoiceWindow }[];
  byCategory: CategoryTotal[];
  series: MonthPoint[];
  month: string;
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
  onLayoutMoveTo: (id: CardId, targetId: CardId) => void;
  onLayoutSpan: (id: CardId, span: number) => void;
  onLayoutMode: (id: CardId, mode: CardMode) => void;
  onLayoutReset: () => void;
  onLayoutDone: () => void;
  onEditIncome: () => void;
}

export function OverviewScreen({
  plan,
  cards,
  byCategory,
  series,
  month,
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
  onLayoutMoveTo,
  onLayoutSpan,
  onLayoutMode,
  onLayoutReset,
  onLayoutDone,
}: OverviewProps) {
  const { lang, t } = useLanguage();
  const [dragId, setDragId] = useState<CardId | null>(null);
  const [dropId, setDropId] = useState<CardId | null>(null);
  // The order shown while dragging: the dashboard rearranges itself as a preview
  // and only the drop commits it.
  const [preview, setPreview] = useState<LayoutCard[] | null>(null);
  const [donutHover, setDonutHover] = useState<number | null>(null);
  const dragCells = useRef<{ id: CardId; rect: DOMRect }[]>([]);
  const spending = byCategory.reduce((total, item) => total + item.totalCents, 0);
  // Biggest first, and the tail becomes one slice: a legend of twelve rows is a
  // list, not a chart.
  const ranked = [...byCategory].sort((left, right) => right.totalCents - left.totalCents);
  const topCategories = ranked.slice(0, 5);
  const restCents = ranked.slice(5).reduce((total, item) => total + item.totalCents, 0);
  const donutSlices =
    ranked.length > 5
      ? [
          ...topCategories.map((item) => ({
            name: item.name,
            color: item.color,
            value: item.totalCents,
          })),
          { name: t("ledger.otherCategories"), color: "var(--faint)", value: restCents },
        ]
      : topCategories.map((item) => ({
          name: item.name,
          color: item.color,
          value: item.totalCents,
        }));
  const peak = Math.max(...series.slice(-6).map((point) => point.expenseCents), 1);
  const keptShare =
    plan.incomeCents > 0 ? Math.round((plan.forecastCents / plan.incomeCents) * 100) : 0;

  // Cards that the plan does not support stay out of the grid, and a card the
  // user took off the dashboard waits in the shelf until it is added back.
  const cardContext = { people: people.length, housingCents: plan.housingCents };
  const shown = preview ?? layout;
  const visible = shown.filter(
    (item) => item.mode !== "hidden" && isCardAvailable(item.id, cardContext),
  );
  const shelved = layout.filter(
    (item) => item.mode === "hidden" && isCardAvailable(item.id, cardContext),
  );

  // A card that occupies more than one column has room to say more, so it does
  // instead of stretching the same content over a wider box.
  const isWide = (id: CardId) => (layout.find((entry) => entry.id === id)?.span ?? 1) >= 2;
  const seriesPeak = Math.max(
    ...(isWide("series") ? series.slice(-12) : series.slice(-6)).map((point) => point.expenseCents),
    1,
  );

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

  // The button in the card toolbar always names what the next step will do.
  const modeLabel = (mode: CardMode) =>
    mode === "reduced"
      ? t("layout.hideDetails")
      : mode === "compact"
        ? t("layout.collapse")
        : mode === "mini"
          ? t("layout.minimise")
          : t("layout.expand");

  const modeShort = (mode: CardMode) =>
    mode === "reduced"
      ? t("layout.actionHide")
      : mode === "compact"
        ? t("layout.actionCompact")
        : mode === "mini"
          ? t("layout.actionMinimise")
          : t("layout.actionExpand");

  const modeIcon = (mode: CardMode): IconName =>
    mode === "compact" ? "chevron-down" : mode === "mini" ? "arrow-down-to-line" : "chevron-up";

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
      </article>
    ),
    bills: <BillsCard plan={plan} onToggle={onToggleBill} onAdd={onAddBill} onEdit={onEditBill} />,
    cards: (
      <CardsCard
        cards={cards}
        month={month}
        onAdd={onAddCard}
        onEdit={onEditCard}
        wide={isWide("cards")}
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
        onAssign={onAssignShare}
        onSettle={onSettle}
      />
    ),
    donut: (
      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <Icon3D name="pie" size={30} />
            <h2>{t("ledger.whereMoney")}</h2>
          </div>
          <span className="muted">{monthLabel(month, lang)}</span>
        </header>

        {byCategory.length === 0 ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <div className="breakdown">
            <div className="breakdown-figure">
              <strong>{formatCents(spending)}</strong>
              <span className="muted small">{t("ledger.spending")}</span>
            </div>
            <BreakdownBar items={donutSlices} active={donutHover} onActive={setDonutHover} />
            <ul className="legend">
              {donutSlices.map((slice, index) => (
                <li
                  key={slice.name}
                  className={donutHover === index ? "legend-row active" : "legend-row"}
                  onPointerEnter={() => setDonutHover(index)}
                  onPointerLeave={() => setDonutHover(null)}
                >
                  <span className="dot" style={{ background: slice.color }} />
                  <span className="legend-name">{slice.name}</span>
                  <span className="legend-value">{formatCents(slice.value)}</span>
                  <span className="legend-share">
                    {spending > 0 ? Math.round((slice.value / spending) * 100) : 0}%
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
            <Icon3D name="chart-up" size={30} />
            <h2>{isWide("series") ? t("ledger.lastTwelve") : t("ledger.lastSix")}</h2>
          </div>
          <span className="muted">{t("ledger.spending")}</span>
        </header>
        {series.every((point) => point.expenseCents === 0) ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <div className="bars">
            {series.slice(isWide("series") ? -12 : -6).map((point) => (
              <button
                type="button"
                className="bar-col"
                key={point.month}
                onClick={() => onSelectMonth(point.month)}
                aria-current={point.month === month}
                aria-label={`${monthLabel(point.month, lang)}: ${formatCents(point.expenseCents)}`}
              >
                <span className="bar-value">
                  {point.month === month && point.expenseCents > 0
                    ? formatCents(point.expenseCents)
                    : ""}
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
                          : `${Math.max(3, (point.expenseCents / seriesPeak) * 100)}%`,
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

  // Only the cards card has a block that can be hidden on its own.
  const leanCells: Partial<Record<CardId, ReactNode>> = {
    cards: <CardsCard cards={cards} month={month} onAdd={onAddCard} onEdit={onEditCard} lean />,
  };

  // The compact form of a card keeps the information and drops the furniture: a
  // header line with the figure and one small visual for the card's own measure.
  const compactCells: Record<CardId, ReactNode> = {
    forecast: (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="piggy" size={22} />
          <span className="compact-title">{t("overview.forecast")}</span>
          <span className="compact-value">{formatCents(plan.forecastCents)}</span>
        </div>
        <div className="compact-body">
          <Progress
            value={Math.abs(keptShare)}
            size="sm"
            tone={plan.forecastCents >= 0 ? "positive" : "negative"}
            label={t("overview.forecast")}
          />
          <span className="muted small">
            {plan.forecastCents >= 0
              ? t("overview.keptShare", { percent: Math.abs(keptShare) })
              : t("overview.overShare", { percent: Math.abs(keptShare) })}
          </span>
        </div>
      </article>
    ),
    bills: (
      <BillsCard plan={plan} onToggle={onToggleBill} onAdd={onAddBill} onEdit={onEditBill} compact />
    ),
    cards: <CardsCard cards={cards} month={month} onAdd={onAddCard} onEdit={onEditCard} compact />,
    housing: (
      <HousingCard
        plan={plan}
        scope={housingScope}
        onScope={onHousingScope}
        onEdit={onEditHousing}
        compact
      />
    ),
    goals: <GoalsCard plan={plan} onAdd={onAddGoal} compact />,
    split: (
      <SplitCard
        people={people}
        shares={shares}
        bills={plan.dueBills}
        settled={splitSettled}
        onAssign={onAssignShare}
        onSettle={onSettle}
        compact
      />
    ),
    donut: (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="pie" size={22} />
          <span className="compact-title">{t("ledger.whereMoney")}</span>
          <span className="compact-value">{formatCents(spending)}</span>
        </div>
        <div className="compact-body">
          <Donut
            size={44}
            thickness={10}
            segments={byCategory.map((item) => ({ color: item.color, value: item.totalCents }))}
          />
          <span className="muted small">
            {byCategory[0] ? byCategory[0].name : t("ledger.noSpending")}
          </span>
        </div>
      </article>
    ),
    series: (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="chart-up" size={22} />
          <span className="compact-title">{t("ledger.lastSix")}</span>
          <span className="compact-value">
            {formatCents(series.find((point) => point.month === month)?.expenseCents ?? 0)}
          </span>
        </div>
        <div className="compact-body">
          <div className="spark" aria-hidden="true">
            {series.slice(-6).map((point) => (
              <span
                key={point.month}
                className={point.month === month ? "current" : undefined}
                style={{ height: `${Math.max(8, (point.expenseCents / peak) * 100)}%` }}
                title={`${monthLabel(point.month, lang)}: ${formatCents(point.expenseCents)}`}
              />
            ))}
          </div>
        </div>
      </article>
    ),
  };

  // Cards have very different heights, so they declare how many row units they
  // take and the grid packs them without the holes a fixed row height leaves.
  const ROW_UNIT = 4;
  const ROW_GAP = 14;
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowSpans, setRowSpans] = useState<Record<string, number>>({});
  const drag = useRef<{
    id: CardId;
    pointerId: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    if (!dragId) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      drag.current = null;
      setDragId(null);
      setDropId(null);
      setPreview(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [dragId]);

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
        className="planner-grid"
        ref={gridRef}
        onPointerLeave={() => setDropId(null)}
      >
        {visible.map((item, index) => {
          // Only the smallest step becomes a chip, one column wide, so it can
          // fill the single column holes the tall cards leave behind. The compact
          // card is still a card: it keeps its width and shows its figures.
          const chip = item.mode === "mini";
          const span = chip ? 1 : item.span;
          const target = nextMode(item.mode, hasDetailsSection(item.id));
          const cellClass = [
            "grid-cell",
            `span-${span}`,
            item.id === "bills" ? "natural" : "",
            dragId === item.id ? "is-dragging" : "",
            dropId === item.id ? "is-drop-target" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
          <div
            key={item.id}
            className={cellClass}
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
                active: Boolean(grip),
              };
              if (grip) {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragId(item.id);
              }
            }}
            onPointerMove={(event) => {
              const state = drag.current;
              if (!state || state.pointerId !== event.pointerId) return;
              if (!state.active) {
                if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < 6) return;
                state.active = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                dragCells.current = Array.from(
                  gridRef.current?.querySelectorAll<HTMLElement>("[data-card]") ?? [],
                ).map((cell) => ({
                  id: cell.dataset.card as CardId,
                  rect: cell.getBoundingClientRect(),
                }));
                setDragId(state.id);
              }
              const landing = cardAt(event.clientX, event.clientY, dragCells.current, state.id);
              if (landing && landing !== dropId) {
                setDropId(landing);
                setPreview(moveCardTo(layout, state.id, landing));
              }
            }}
            onPointerUp={(event) => {
              const state = drag.current;
              drag.current = null;
              if (!state || state.pointerId !== event.pointerId) return;
              // The landing is read from where the pointer actually stopped, so
              // letting go over a gap or outside the grid cancels instead of
              // committing whatever was last hovered.
              const landing = state.active
                ? cardAt(event.clientX, event.clientY, dragCells.current, state.id)
                : null;
              if (landing) onLayoutMoveTo(state.id, landing);
              setDragId(null);
              setDropId(null);
              setPreview(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragId(null);
              setDropId(null);
              setPreview(null);
            }}
            style={{ gridRowEnd: `span ${rowSpans[item.id] ?? 1}` }}
          >
            {chip ? (
              <button
                type="button"
                className="collapsed-card is-mini"
                onClick={() => onLayoutMode(item.id, "full")}
                title={t("layout.expand")}
                aria-label={`${cardName(item.id)} · ${t("layout.expand")}`}
              >
                <span className="collapsed-card-title">{cardName(item.id)}</span>
                <span className="collapsed-card-value">{collapsedFigure(item.id)}</span>
                <span className="collapse-trigger" aria-hidden="true">
                  <Icon name="chevron-down" size={13} />
                </span>
              </button>
            ) : item.mode === "compact" ? (
              compactCells[item.id]
            ) : item.mode === "reduced" && leanCells[item.id] ? (
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
                    const above = visible[index - 1];
                    const below = visible[index + 1];
                    if (event.key === "ArrowUp" && above) {
                      event.preventDefault();
                      onLayoutMoveTo(item.id, above.id);
                    }
                    if (event.key === "ArrowDown" && below) {
                      event.preventDefault();
                      onLayoutMoveTo(item.id, below.id);
                    }
                  }}
                >
                  <Icon name="grip" size={15} />
                </button>
                <span className="cell-tools-sep" aria-hidden="true" />
                {chip ? null : (
                  <>
                    <span className="cell-spans" role="group" aria-label={t("layout.width")}>
                      {[1, 2, 3].map((span) => (
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
                  className="cell-mode"
                  aria-label={modeLabel(target)}
                  title={modeLabel(target)}
                  onClick={() => onLayoutMode(item.id, target)}
                >
                  <Icon name={modeIcon(target)} size={14} />
                  <span>{modeShort(target)}</span>
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
          </div>
          );
        })}
      </div>
    </section>
  );
}
