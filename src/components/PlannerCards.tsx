import { useEffect, useRef, useState } from "react";
import type { Bill, CardMeta, Goal, Income, Person, PersonInput, Share, TransactionRow } from "../lib/api";
import type { InvoiceWindow } from "../domain/invoice";
import { invoiceLines, invoiceUsage, invoiceWindow } from "../domain/invoice";
import { dateInMonth, monthRange } from "../domain/month";
import type { MonthPlan } from "../domain/projection";
import { groupByDay } from "../domain/projection";
import { computeSplit, selfPartOf } from "../domain/split";
import { scopeOfBill } from "../domain/scope";
import { api } from "../lib/api";
import { currentMonth, formatCents, formatDate, monthName, todayIso } from "../lib/format";
import { useLanguage } from "../lib/language";
import { CreditCardArt } from "./CreditCardArt";
import { Icon } from "./Icons";
import { Money } from "./Money";
import { IconBubble } from "./editorial";
import { Icon3D } from "./Icon3D";
import { Progress } from "./ui/progress";
import { InvoiceDialog } from "./InvoiceDialog";
import { PayInvoiceDialog } from "./PayInvoiceDialog";
import { usePaidInvoices } from "../lib/paidInvoices";
import { UpcomingInvoices } from "./UpcomingInvoices";

interface BillsProps {
  plan: MonthPlan;
  people: Person[];
  housingCategoryId: number | null;
  onToggle: (billId: number, paid: boolean) => void;
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
  compact?: boolean;
}

export function BillsCard({ plan, people, housingCategoryId, onToggle, onAdd, onEdit, compact = false }: BillsProps) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<"all" | "overdue" | "ontime">("all");
  const [scope, setScope] = useState<"all" | "personal" | "house">("all");
  const [moreFilters, setMoreFilters] = useState(false);
  const total = plan.plannedCents;
  const paidCount = plan.paidBillIds.length;
  const count = plan.dueBills.length;
  const today = new Date().getDate();
  const isCurrentMonth = plan.month === currentMonth();
  const isOverdue = (bill: Bill) =>
    !plan.paidBillIds.includes(bill.id) && isCurrentMonth && bill.dueDay < today;
  const visibleBills =
    filter === "all" && scope === "all"
      ? plan.dueBills
      : plan.dueBills.filter(
          (bill) =>
            (filter === "all" || (filter === "overdue" ? isOverdue(bill) : !isOverdue(bill))) &&
            (scope === "all" || scopeOfBill(bill, housingCategoryId) === scope),
        );
  const visibleGroups = groupByDay(visibleBills);
  const activeDay = isCurrentMonth
    ? (visibleGroups.find((group) => group.day >= today)?.day ?? visibleGroups.at(-1)?.day)
    : visibleGroups[0]?.day;

  if (compact) {
    const paidShare = count > 0 ? (paidCount / count) * 100 : 0;
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="calendar" size={22} />
          <span className="compact-title">{t("planner.bills")}</span>
          <span className="compact-value">{formatCents(total)}</span>
        </div>
        <div className="compact-body">
          <Progress
            value={paidShare}
            size="sm"
            tone={count > 0 && paidCount === count ? "positive" : "primary"}
            label={t("planner.bills")}
          />
          <span className="muted small">{t("planner.paidOf", { paid: paidCount, count })}</span>
        </div>
      </article>
    );
  }

  return (
    <article className="card bills-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.bills")}</h2>
        </div>
        <button type="button" className="round-button" onClick={onAdd} aria-label={t("planner.newBill")}>
          <Icon name="plus" size={16} />
        </button>
        <Icon3D name="calendar" className="card-art" />
      </header>

      <div className="card-figure">
        <strong><Money cents={total} /></strong>
        <span className="muted small">
          {t("planner.paidOf", { paid: paidCount, count })}
        </span>
      </div>

      {count > 0 ? (
        <>
          <div className="bills-filters">
          <div className="segmented" role="group" aria-label={t("planner.bills")}>
            {(
              [
                { id: "all", key: "planner.billsAll" },
                { id: "overdue", key: "planner.billsOverdue" },
                { id: "ontime", key: "planner.billsOnTime" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                className={filter === option.id ? "active" : undefined}
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={moreFilters || scope !== "all" ? "more-filters active" : "more-filters"}
            aria-expanded={moreFilters}
            onClick={() => setMoreFilters((open) => !open)}
          >
            {t("planner.moreFilters")}
          </button>
          </div>
          {moreFilters ? (
            <div className="bills-more">
            <div className="segmented" role="group" aria-label={t("planner.scope")}>
              {(
                [
                  { id: "all", key: "planner.scopeAll" },
                  { id: "personal", key: "planner.scopePersonal" },
                  { id: "house", key: "planner.scopeHouse" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={scope === option.id ? "active" : undefined}
                  aria-pressed={scope === option.id}
                  onClick={() => setScope(option.id)}
                >
                  {t(option.key)}
                </button>
              ))}
            </div>
              <div className="day-pills" role="list">
          {visibleGroups.map((group) => (
            <span
              key={group.day}
              className={group.day === activeDay ? "day-pill active" : "day-pill"}
              role="listitem"
              aria-current={group.day === activeDay ? "date" : undefined}
              title={group.count === 1 ? t("planner.dayBillsOne") : t("planner.dayBills", { count: group.count })}
            >
              <b>{String(group.day).padStart(2, "0")}</b>
              <em>{group.count}</em>
            </span>
          ))}
        </div>
            </div>
          ) : null}
        </>
      ) : null}


      {count === 0 ? (
        <button type="button" className="empty-add" onClick={onAdd}>
          <Icon name="plus" size={18} />
          {t("planner.addBill")}
        </button>
      ) : visibleBills.length === 0 ? (
        <p className="muted small">{t("planner.billsNone")}</p>
      ) : (
        <ul className="bill-list">
          {visibleBills.map((bill) => {
            const paid = plan.paidBillIds.includes(bill.id);
            const late = isOverdue(bill);
            const share = selfPartOf(bill, people);
            return (
              <li key={bill.id} className={paid ? "bill paid" : late ? "bill late" : "bill"}>
                <label className="bill-check">
                  <input
                    type="checkbox"
                    checked={paid}
                    onChange={(event) => onToggle(bill.id, event.target.checked)}
                    aria-label={bill.name}
                  />
                  <span className="bill-dot" style={{ background: bill.categoryColor ?? "var(--line-strong)" }} />
                  <span className="bill-name" onClick={() => onEdit(bill)} role="presentation">
                    {bill.name}
                  </span>
                </label>
                <span className="bill-figures">
                  <span className="bill-amount">{formatCents(bill.amountCents)}</span>
                  {share !== null ? (
                    <span className="bill-share">
                      {t("planner.myShare", { amount: formatCents(share) })}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

interface CardsProps {
  cards: { meta: CardMeta; usageCents: number; window: InvoiceWindow }[];
  month: string;
  onAdd: () => void;
  onEdit: (card: CardMeta) => void;
  /** The lean form of the card: no upcoming invoices, only what is due now. */
  lean?: boolean;
  /** The compact form: one line of figures instead of the carousel. */
  compact?: boolean;
  /** Columns the card spans: 2 adds the upcoming invoices, 3 also the active invoice's lines. */
  span?: number;
}

const CARD_GAP = 12;
const CARD_FALLBACK = 280;

export function CardsCard({
  cards,
  month,
  onAdd,
  onEdit,
  lean = false,
  compact = false,
  span = 1,
}: CardsProps) {
  const { lang, t } = useLanguage();
  const [rows, setRows] = useState<Record<number, TransactionRow[]>>({});
  const [activeCard, setActiveCard] = useState(0);
  const [monthIndex, setMonthIndex] = useState(0);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const invoices = usePaidInvoices();
  const [payOpen, setPayOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // One fetch per card account gives the dialog its lines and the tiles their
  // future invoices, all derived from the same statement rows.
  const targets = cards.map((entry) => `${entry.meta.id}:${entry.meta.accountId}`).join(",");
  // A changed usage means a purchase changed, so the statement rows are read again.
  const usages = cards.map((entry) => entry.usageCents).join(",");
  useEffect(() => {
    const pairs = targets
      ? targets.split(",").map((part) => {
          const [id, accountId] = part.split(":").map(Number);
          return { id, accountId };
        })
      : [];
    if (pairs.length === 0) {
      setRows({});
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(
        pairs.map(async (pair) => {
          const list = await api
            .transactions(undefined, undefined, pair.accountId, 2000)
            .catch(() => [] as TransactionRow[]);
          return [pair.id, list] as const;
        }),
      );
      if (!cancelled) setRows(Object.fromEntries(loaded));
    })();
    return () => {
      cancelled = true;
    };
  }, [targets, usages]);

  useEffect(() => {
    setMonthIndex(0);
  }, [month]);

  if (compact) {
    const first = cards[0];
    const limit = first?.meta.limitCents ?? 0;
    const spend = first?.usageCents ?? 0;
    const share = limit > 0 ? Math.min(100, (spend / limit) * 100) : 0;
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="credit-card" size={22} />
          <span className="compact-title">{t("planner.cards")}</span>
          <span className="compact-value">{formatCents(spend)}</span>
        </div>
        <div className="compact-body">
          <Progress value={share} size="sm" label={t("planner.cards")} />
          <span className="muted small">
            {t("planner.invoiceOf", { month: monthName(month, lang) })}
          </span>
        </div>
      </article>
    );
  }

  if (cards.length === 0) {
    return (
      <article className="card cards-card card-with-art">
        <header className="card-head">
          <div className="card-title">
            <h2>{t("planner.cards")}</h2>
          </div>
          <button type="button" className="round-button" onClick={onAdd} aria-label={t("planner.cardTitle")}>
            <Icon name="plus" size={16} />
          </button>
          <Icon3D name="credit-card" className="card-art" />
        </header>
        <button type="button" className="empty-add" onClick={onAdd}>
          <Icon name="plus" size={18} />
          {t("planner.addCard")}
        </button>
      </article>
    );
  }

  const index = Math.min(activeCard, cards.length - 1);
  const entry = cards[index];
  const months = monthRange(month, 3);
  const activeIndex = Math.min(monthIndex, months.length - 1);
  const activeMonth = months[activeIndex];
  const list = rows[entry.meta.id];
  const today = todayIso();

  const usageFor = (meta: CardMeta, target: string) => {
    const found = rows[meta.id];
    if (!found) return meta.id === entry.meta.id && target === month ? entry.usageCents : 0;
    return invoiceUsage(found, invoiceWindow(meta.closingDay, meta.dueDay, target));
  };

  const values = months.map((candidate) => usageFor(entry.meta, candidate));
  const usage = values[activeIndex];
  const window = invoiceWindow(entry.meta.closingDay, entry.meta.dueDay, activeMonth);
  const entryOpen = window.to >= today;
  const paid = invoices.isPaid(entry.meta.id, activeMonth);
  const record = invoices.paidInvoice(entry.meta.id, activeMonth);
  const paidCents = record && record.amountCents > 0 ? record.amountCents : usage;
  // The invoice grew after it was paid (a purchase was edited or added): what is left to pay.
  const extraCents = paid && record && record.amountCents > 0 ? Math.max(usage - record.amountCents, 0) : 0;
  const togglePaid = () => {
    if (paid) void invoices.unmarkPaid(entry.meta.id, activeMonth);
    else setPayOpen(true);
  };
  const lines = list ? invoiceLines(list, window) : [];
  const canScroll = cards.length > 1;
  const split = !lean && span >= 3;

  // The step comes from the card the browser laid out, so a change in the CSS
  // width cannot desync the arrows from the snap points.
  const cardStep = () => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(".credit-card");
    return (card?.offsetWidth ?? CARD_FALLBACK) + CARD_GAP;
  };

  const scrollToCard = (next: number) => {
    const clamped = Math.min(Math.max(0, next), cards.length - 1);
    setActiveCard(clamped);
    trackRef.current?.scrollTo({ left: clamped * cardStep(), behavior: "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    // The trailing "add" slide is not a card, so the index stops at the last real one.
    const next = Math.min(cards.length - 1, Math.round(track.scrollLeft / cardStep()));
    if (next !== activeCard) setActiveCard(next);
  };

  return (
    <article className="card cards-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.cards")}</h2>
        </div>
        <div className="cards-controls">
          <button type="button" className="round-button" onClick={onAdd} aria-label={t("planner.cardTitle")}>
            <Icon name="plus" size={16} />
          </button>
          {canScroll ? (
            <>
              <button
                type="button"
                className="round-button static"
                disabled={index === 0}
                onClick={() => scrollToCard(index - 1)}
                aria-label={t("planner.previousCard")}
              >
                <Icon name="chevron-left" size={18} />
              </button>
              <button
                type="button"
                className="round-button static"
                disabled={index === cards.length - 1}
                onClick={() => scrollToCard(index + 1)}
                aria-label={t("planner.nextCard")}
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </>
          ) : null}
        </div>
        <Icon3D name="credit-card" className="card-art" />
      </header>

      <div className="card-figure">
        <strong><Money cents={paid ? extraCents : usage} /></strong>
        <span className="muted small">
          {entry.meta.brand || t("planner.card")} •••• {entry.meta.last4 || "0000"} ·{" "}
          {t("planner.invoiceOf", { month: monthName(activeMonth, lang) })}
        </span>
        {paid ? <span className="muted small">{t("planner.paidAmount", { amount: formatCents(paidCents) })}</span> : null}
        {extraCents > 0 ? <span className="muted small">{t("planner.grewAfterPaid")}</span> : null}
        <span className="card-status">
          <span
            className="dot"
            style={{ background: entryOpen ? "var(--positive)" : "var(--line-strong)" }}
          />
          {extraCents > 0 ? t("planner.paidPartly") : paid ? t("planner.paid") : entryOpen ? t("planner.open") : t("planner.closed")}
        </span>
      </div>

      <div className="card-actions">
        <button type="button" className="outline-button" onClick={() => setInvoiceOpen(true)}>
          <Icon name="file-text" size={16} />
          {t("planner.viewInvoice")}
        </button>
        <button type="button" className="outline-button" aria-pressed={paid} onClick={togglePaid}>
          <Icon name="check" size={16} />
          {paid ? t("planner.unmarkPaid") : t("planner.markPaid")}
        </button>
        {extraCents > 0 ? (
          <button type="button" className="outline-button" onClick={() => setPayOpen(true)}>
            <Icon name="check" size={16} />
            {t("planner.payDifference")}
          </button>
        ) : null}
      </div>

      <div className={split ? "cards-body is-split" : "cards-body"}>
        <div className="cards-main">
        <div
          className="cards-track"
          ref={trackRef}
          onScroll={onScroll}
        >
          {cards.map(({ meta }) => {
            const state = invoiceWindow(meta.closingDay, meta.dueDay, activeMonth);
            const open = state.to >= today;
            return (
              <button
                key={meta.id}
                type="button"
                className="credit-card credit-card-real"
                onClick={() => onEdit(meta)}
              >
                <CreditCardArt meta={meta} status={open ? t("planner.open") : t("planner.closed")} />
              </button>
            );
          })}
          <button type="button" className="credit-card credit-card-add" onClick={onAdd}>
            <Icon name="plus" size={20} />
            <span>{t("planner.addCard")}</span>
          </button>
        </div>

        {lean ? null : (
          <UpcomingInvoices
            months={months}
            values={values}
            activeIndex={activeIndex}
            onSelect={setMonthIndex}
          />
        )}
        </div>
        {split ? (
          <aside className="invoice-panel">
            <span className="upcoming-label">{t("planner.panelTitle")}</span>
            <span className="muted small">
              {t("planner.dueOn", { date: formatDate(dateInMonth(activeMonth, entry.meta.dueDay)) })}
            </span>
            {lines.length === 0 ? (
              <span className="muted small">{t("planner.noInvoiceLines")}</span>
            ) : (
              <ul className="invoice-panel-list">
                {[...lines].reverse().slice(0, 6).map((line) => (
                  <li key={line.id}>
                    <span className="invoice-panel-name">{line.description}</span>
                    <span className="muted small">{formatDate(line.postedOn)}</span>
                    <strong>{formatCents(Math.abs(line.amountCents))}</strong>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        ) : null}
      </div>

      {invoiceOpen ? (
        <InvoiceDialog
          card={entry.meta}
          month={activeMonth}
          window={window}
          dueDate={dateInMonth(activeMonth, entry.meta.dueDay)}
          lines={lines}
          totalCents={usage}
          paid={paid}
          paidCents={paidCents}
          onTogglePaid={togglePaid}
          onClose={() => setInvoiceOpen(false)}
        />
      ) : null}
      {payOpen ? (
        <PayInvoiceDialog
          card={entry.meta}
          month={activeMonth}
          amountCents={extraCents > 0 ? extraCents : usage}
          onPaid={(paidRecord) =>
            void invoices.markPaid(
              entry.meta.id,
              activeMonth,
              extraCents > 0 ? { ...paidRecord, amountCents: paidCents + paidRecord.amountCents } : paidRecord,
            )
          }
          onClose={() => setPayOpen(false)}
        />
      ) : null}
    </article>
  );
}

interface HousingProps {
  plan: MonthPlan;
  scope: "primary" | "total";
  onScope: (scope: "primary" | "total") => void;
  onEdit: () => void;
  compact?: boolean;
  wide?: boolean;
}

export function HousingCard({
  plan,
  scope,
  onScope,
  onEdit,
  compact = false,
  wide = false,
}: HousingProps) {
  const { lang, t } = useLanguage();
  const ratioPct = scope === "primary" ? plan.housingRatioPrimaryPct : plan.housingRatioPct;
  // 36,8 in Portuguese, 36.8 in English.
  const ratioText = ratioPct.toLocaleString(lang === "pt" ? "pt-BR" : "en-US", {
    maximumFractionDigits: 1,
  });
  const ratio = Math.min(100, ratioPct);
  const over = ratioPct > plan.ceilingPct;

  if (compact) {
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="house" size={22} />
          <span className="compact-title">{t("planner.housing")}</span>
          <span className="compact-value">{formatCents(plan.housingCents)}</span>
        </div>
        <div className="compact-body">
          <Progress
            value={ratio}
            size="sm"
            tone={over ? "negative" : "positive"}
            label={t("planner.housing")}
          />
          <span className={over ? "muted small over" : "muted small"}>
            {t("planner.ceilingShort", { percent: ratioText, ceiling: plan.ceilingPct })}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article className="card housing-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.housing")}</h2>
        </div>
        <button type="button" className="round-button" onClick={onEdit} aria-label={t("planner.housingCeiling")}>
          <Icon name="settings" size={15} />
        </button>
        <Icon3D name="house" className="card-art" />
      </header>

      <div className="card-figure">
        <strong><Money cents={plan.housingCents} /></strong>
        <span className={over ? "delta-line down" : "delta-line"}>
          {over ? <b aria-hidden="true">!</b> : <Icon name="check" size={14} />}
          {t("planner.housingRatio", { percent: ratioText, ceiling: plan.ceilingPct })}
        </span>
      </div>

      <div className="segmented" role="group" aria-label={t("planner.incomeScope")}>
        <button
          type="button"
          className={scope === "primary" ? "active" : undefined}
          aria-pressed={scope === "primary"}
          onClick={() => onScope("primary")}
        >
          {t("planner.scopePrimary")}
        </button>
        <button
          type="button"
          className={scope === "total" ? "active" : undefined}
          aria-pressed={scope === "total"}
          onClick={() => onScope("total")}
        >
          {t("planner.scopeTotal")}
        </button>
      </div>

      <div className="meter">
        <div className="meter-track tall">
          <div className={over ? "meter-fill over" : "meter-fill"} style={{ width: `${ratio}%` }} />
          <span className="meter-mark" style={{ left: `${Math.min(100, plan.ceilingPct)}%` }} />
        </div>
        <div className="meter-scale">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {wide && plan.housingBills.length > 0 ? (
        <ul className="housing-breakdown">
          {plan.housingBills.map((bill) => (
            <li key={bill.id}>
              <span
                className="dot"
                style={{ background: bill.categoryColor ?? "var(--primary)" }}
              />
              <span className="legend-name">{bill.name}</span>
              <strong>{formatCents(bill.amountCents)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function GoalsCard({
  plan,
  onAdd,
  compact = false,
  wide = false,
}: {
  plan: MonthPlan;
  onAdd: () => void;
  compact?: boolean;
  wide?: boolean;
}) {
  const { t } = useLanguage();
  const paid = plan.goals.reduce((sum, entry) => sum + entry.paidCents, 0);
  const target = plan.goals.reduce((sum, entry) => sum + entry.goal.targetCents, 0);
  const share = target > 0 ? Math.min(100, (paid / target) * 100) : 0;

  if (compact) {
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="target" size={22} />
          <span className="compact-title">{t("planner.goals")}</span>
          <span className="compact-value">{formatCents(paid)}</span>
        </div>
        <div className="compact-body">
          <Progress value={share} size="sm" label={t("planner.goals")} />
          <span className="muted small">{t("layout.goalCount", { count: plan.goals.length })}</span>
        </div>
      </article>
    );
  }

  return (
    <article className="card goals-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.goals")}</h2>
        </div>
        <button type="button" className="round-button" onClick={onAdd} aria-label={t("planner.goalTitle")}>
          <Icon name="plus" size={16} />
        </button>
        <Icon3D name="target" className="card-art" />
      </header>

      {plan.goals.length === 0 ? (
        <button type="button" className="empty-add" onClick={onAdd}>
          <Icon name="plus" size={18} />
          {t("planner.addGoal")}
        </button>
      ) : (
        <ul className={wide ? "goal-list two-col" : "goal-list"}>
          {plan.goals.map(({ goal, paidCents, sharePct }: { goal: Goal; paidCents: number; sharePct: number }) => (
            <li key={goal.id}>
              <div className="goal-head">
                <span className="goal-name">
                  {goal.name}
                  {goal.kind !== "reserve" ? (
                    <em className="pill-soft">{t("planner.estimated")}</em>
                  ) : null}
                </span>
                <span className="muted small">
                  {formatCents(paidCents)} / {formatCents(goal.targetCents)}
                </span>
              </div>
              <div className="meter-track slim">
                <div className="meter-fill" style={{ width: `${sharePct}%`, background: goal.color }} />
              </div>
              <span className="muted small">{t("planner.goalProgress", { percent: Math.round(sharePct) })}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface SplitProps {
  people: Person[];
  shares: Share[];
  bills: Bill[];
  settled: boolean;
  onAssign: (billId: number, personId: number) => void;
  onSettle: () => void;
  /** Couples that do not square up afterwards turn the settlement off. */
  trackSettlement?: boolean;
  compact?: boolean;
}

/** Who pays each bill of the month, and who ends up owing whom. */
export function SplitCard({
  people,
  shares,
  bills,
  settled,
  onAssign,
  onSettle,
  trackSettlement = true,
  compact = false,
}: SplitProps) {
  const { t } = useLanguage();
  const split = computeSplit(people, shares, bills);

  if (compact) {
    const partner = split.partnerPerson?.name ?? t("split.partner");
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="scale" size={22} />
          <span className="compact-title">{t("split.title")}</span>
          <span className="compact-value">
            {people.length > 1 ? formatCents(split.totalCents) : "—"}
          </span>
        </div>
        {people.length > 1 ? (
          <div className="compact-body">
            <div className="split-bar tight">
              <span className="split-self" style={{ width: `${split.selfPct}%` }} />
              <span className="split-partner" style={{ width: `${split.partnerPct}%` }} />
            </div>
            <span className="muted small">{partner}</span>
          </div>
        ) : (
          <span className="muted small">{t("split.noPartner")}</span>
        )}
      </article>
    );
  }

  if (people.length < 2) {
    return (
      <article className="card split-card">
        <header className="card-head">
          <div className="card-title">
            <h2>{t("split.title")}</h2>
          </div>
        </header>
        <p className="card-empty">{t("split.noPartner")}</p>
      </article>
    );
  }

  const many = people.length > 2;
  const selfName = t("split.you");
  const partnerName = split.partnerPerson?.name ?? t("split.partner");

  return (
    <article className="card split-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("split.title")}</h2>
        </div>
        <IconBubble name="scale" size="sm" />
      </header>

      <div className="card-figure">
        <strong><Money cents={split.totalCents} /></strong>
        <span className="muted small">{t("split.total")}</span>
      </div>

      {many ? (
        <div className="split-bar">
          {split.perPerson.map((entry) => (
            <span
              key={entry.person.id}
              style={{ width: `${entry.pct}%`, background: entry.person.color }}
            />
          ))}
        </div>
      ) : (
        <div className="split-bar">
          <span className="split-self" style={{ width: `${split.selfPct}%`, background: split.selfPerson?.color }} />
          <span className="split-partner" style={{ width: `${split.partnerPct}%`, background: split.partnerPerson?.color }} />
          <span className="split-mark" style={{ left: `${split.targetSelfPct}%` }} />
        </div>
      )}

      <ul className="split-legend">
        {split.perPerson.map((entry) => (
          <li key={entry.person.id}>
            <span
              className={many ? "dot" : `dot split-dot ${entry.person.isSelf ? "self" : "partner"}`}
              style={{ background: entry.person.color }}
            />
            <span>{entry.person.isSelf ? selfName : entry.person.name}</span>
            <strong>{formatCents(entry.paidCents)}</strong>
            <span className="muted">{Math.round(entry.pct)}%</span>
          </li>
        ))}
      </ul>

      <span className="upcoming-label">{t("split.whoPays")}</span>
      <ul className="split-list">
        {split.lines.map((line) => (
          <li key={line.bill.id}>
            <button
              type="button"
              className="split-row"
              onClick={() => {
                const index = people.findIndex((entry) => entry.id === line.person?.id);
                const next = people[(index + 1) % people.length];
                if (next) onAssign(line.bill.id, next.id);
              }}
              aria-label={t("split.changePayer", { name: line.bill.name })}
            >
              <span className="dot" style={{ background: line.person?.color ?? "var(--faint)" }} />
              <span className="split-name">{line.bill.name}</span>
              <span className="split-amount">{formatCents(line.amountCents)}</span>
            </button>
          </li>
        ))}
      </ul>

      {trackSettlement && many ? (
        <div className="split-foot">
          <ul className="split-balances">
            {split.perPerson
              .filter((entry) => Math.abs(entry.balanceCents) > 0)
              .map((entry) => (
                <li key={entry.person.id} className={entry.balanceCents < 0 ? "down" : undefined}>
                  <span className="dot" style={{ background: entry.person.color }} />
                  {t(entry.balanceCents > 0 ? "split.receives" : "split.pays", {
                    name: entry.person.isSelf ? selfName : entry.person.name,
                    amount: formatCents(Math.abs(entry.balanceCents)),
                  })}
                </li>
              ))}
          </ul>
          <button type="button" className="ghost small-button" onClick={onSettle} disabled={settled}>
            <Icon name="check" size={15} />
            {settled ? t("split.settled") : t("split.markDone")}
          </button>
        </div>
      ) : null}

      {trackSettlement && !many ? (
      <div className="split-foot">
        {split.owes === "partner" ? (
          <span className="split-owes">
            <Icon name="arrow-right" size={15} />
            {t("split.owesYou", { name: partnerName, amount: formatCents(split.settlementCents) })}
          </span>
        ) : split.owes === "self" ? (
          <span className="split-owes down">
            <Icon name="arrow-right" size={15} />
            {t("split.youOwe", { name: partnerName, amount: formatCents(split.settlementCents) })}
          </span>
        ) : (
          <span className="muted small">{t("split.even")}</span>
        )}

        {split.owes ? (
          <button type="button" className="ghost small-button" onClick={onSettle} disabled={settled}>
            <Icon name="check" size={15} />
            {settled ? t("split.settled") : t("split.markDone")}
          </button>
        ) : null}
      </div>
      ) : null}
    </article>
  );
}

/**
 * Who lives in the house and what each one earns. When both incomes are
 * filled the target split follows them, so each pays in proportion. Squaring
 * up afterwards is optional: not every couple does it.
 */
export function PeopleCard({
  people,
  trackSettlement,
  onSave,
  onAdd,
  onRemove,
  incomes,
  onAddIncome,
  onEditIncome,
  onTrackSettlement,
}: {
  people: Person[];
  incomes: Income[];
  onAddIncome: (personId: number) => void;
  onEditIncome: (income: Income) => void;
  trackSettlement: boolean;
  onSave: (inputs: PersonInput[]) => void;
  onAdd: (name: string) => void;
  onRemove: (id: number) => void;
  onTrackSettlement: (value: boolean) => void;
}) {
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState(() =>
    people.map((person) => ({ id: person.id, name: person.name, color: person.color })),
  );
  const [newName, setNewName] = useState("");
  const dirty = drafts.some((draft, index) => draft.name.trim() !== people[index]?.name || draft.color !== people[index]?.color);
  const valid = drafts.every((draft) => draft.name.trim().length > 0);
  const patch = (id: number, change: { name?: string; color?: string }) =>
    setDrafts((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));

  return (
    <article className="card people-card">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("people.title")}</h2>
        </div>
      </header>
      <p className="muted small">{t("people.desc")}</p>
      <form
        className="people-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || !dirty) return;
          onSave(
            drafts.map((draft, index) => ({
              id: draft.id,
              name: draft.name.trim(),
              incomeCents: people[index]?.incomeCents ?? 0,
              color: draft.color,
            })),
          );
        }}
      >
        {drafts.map((draft, index) => {
          const person = people[index];
          const sources = person ? incomes.filter((entry) => entry.personId === person.id) : [];
          return (
            <div className="person-tile" key={draft.id}>
              <div className="person-head">
                <input
                  type="color"
                  className="color-swatch"
                  value={draft.color ?? "#2563eb"}
                  title={t("people.color")}
                  aria-label={`${t("people.color")}: ${draft.name}`}
                  onChange={(event) => patch(draft.id, { color: event.target.value })}
                />
                <input
                  value={draft.name}
                  maxLength={40}
                  aria-label={person?.isSelf ? t("people.you") : t("people.member")}
                  onChange={(event) => patch(draft.id, { name: event.target.value })}
                />
                {person?.isSelf ? <span className="pill-soft">{t("people.you")}</span> : null}
                {person && !person.isSelf ? (
                  <button
                    type="button"
                    className="icon-button danger"
                    title={t("people.remove")}
                    aria-label={`${t("people.remove")}: ${person.name}`}
                    onClick={() => onRemove(person.id)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                ) : null}
              </div>
              <div className="person-income">
                <span className="muted small">{t("people.income")}</span>
                <strong>{formatCents(person?.incomeCents ?? 0)}</strong>
                <span className="muted small">{t("people.shareOfHouse", { percent: Math.round(person?.weightPct ?? 0) })}</span>
              </div>
              <div className="person-sources">
                {sources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    className="source-chip"
                    title={t("common.edit")}
                    onClick={() => onEditIncome(source)}
                  >
                    {source.name} · {formatCents(source.amountCents)}
                  </button>
                ))}
                {person ? (
                  <button type="button" className="source-chip add" onClick={() => onAddIncome(person.id)}>
                    <Icon name="plus" size={12} />
                    {t("people.addIncome")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        <div className="people-actions">
          <button type="submit" className="primary small-button" disabled={!dirty || !valid}>
            {t("common.save")}
          </button>
        </div>
      </form>

      {people.length < 6 ? (
        <form
          className="people-add"
          onSubmit={(event) => {
            event.preventDefault();
            if (newName.trim() === "") return;
            onAdd(newName.trim());
            setNewName("");
          }}
        >
          <input
            value={newName}
            maxLength={40}
            placeholder={t("people.addPlaceholder")}
            aria-label={t("people.add")}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" className="outline-button small-button" disabled={newName.trim() === ""}>
            <Icon name="plus" size={14} />
            {t("people.add")}
          </button>
        </form>
      ) : null}

      <label className="check people-settle">
        <input
          type="checkbox"
          checked={trackSettlement}
          onChange={(event) => onTrackSettlement(event.target.checked)}
        />
        <span>
          {t("people.settleToggle")}
          <small>{t("people.settleHint")}</small>
        </span>
      </label>
    </article>
  );
}
