import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Bill, CardMeta, Goal, TransactionRow } from "../lib/api";
import type { InvoiceWindow } from "../domain/invoice";
import { invoiceLines, invoiceUsage, invoiceWindow } from "../domain/invoice";
import { dateInMonth, monthRange } from "../domain/month";
import type { MonthPlan } from "../domain/projection";
import { api } from "../lib/api";
import { formatCents, formatDate, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";
import { CardArt, CalendarArt, HouseArt, TargetArt } from "./illustrations";
import { InvoiceDialog } from "./InvoiceDialog";
import { UpcomingInvoices } from "./UpcomingInvoices";

interface BillsProps {
  plan: MonthPlan;
  onToggle: (billId: number, paid: boolean) => void;
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
}

export function BillsCard({ plan, onToggle, onAdd, onEdit }: BillsProps) {
  const { t } = useLanguage();
  const total = plan.plannedCents;
  const paidCount = plan.paidBillIds.length;
  const count = plan.dueBills.length;
  const today = new Date().getDate();
  const isCurrentMonth = plan.month === new Date().toISOString().slice(0, 7);

  return (
    <article className="card bills-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.bills")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.newBill")}>
          <Icon name="plus" size={16} />
        </button>
        <CalendarArt />
      </header>

      <div className="card-figure">
        <strong>{formatCents(total)}</strong>
        <span className="muted small">
          {t("planner.paidOf", { paid: paidCount, count })}
        </span>
      </div>

      {plan.dayGroups.length > 0 ? (
        <div className="day-pills" role="list">
          {plan.dayGroups.map((group) => (
            <span key={group.day} className="day-pill" role="listitem">
              <b>{String(group.day).padStart(2, "0")}</b>
              <em>{group.count}</em>
            </span>
          ))}
        </div>
      ) : null}

      {count === 0 ? (
        <p className="card-empty">{t("planner.noBills")}</p>
      ) : (
        <ul className="bill-list">
          {plan.dueBills.map((bill) => {
            const paid = plan.paidBillIds.includes(bill.id);
            const late = !paid && isCurrentMonth && bill.dueDay < today;
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
                <span className="bill-amount">{formatCents(bill.amountCents)}</span>
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
}

const CARD_WIDTH = 325;
const CARD_GAP = 12;

export function CardsCard({ cards, month, onAdd, onEdit }: CardsProps) {
  const { lang, t } = useLanguage();
  const [rows, setRows] = useState<Record<number, TransactionRow[]>>({});
  const [activeCard, setActiveCard] = useState(0);
  const [monthIndex, setMonthIndex] = useState(0);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // One fetch per card account gives the dialog its lines and the tiles their
  // future invoices, all derived from the same statement rows.
  const targets = cards.map((entry) => `${entry.meta.id}:${entry.meta.accountId}`).join(",");
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
  }, [targets]);

  useEffect(() => {
    setMonthIndex(0);
  }, [month]);

  if (cards.length === 0) {
    return (
      <article className="card cards-card card-with-art">
        <header className="card-head">
          <div className="card-title">
            <h2>{t("planner.cards")}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.cardTitle")}>
            <Icon name="plus" size={16} />
          </button>
          <CardArt />
        </header>
        <p className="card-empty">{t("planner.noCards")}</p>
      </article>
    );
  }

  const index = Math.min(activeCard, cards.length - 1);
  const entry = cards[index];
  const months = monthRange(month, 3);
  const activeIndex = Math.min(monthIndex, months.length - 1);
  const activeMonth = months[activeIndex];
  const list = rows[entry.meta.id];
  const today = new Date().toISOString().slice(0, 10);

  const usageFor = (meta: CardMeta, target: string) => {
    const found = rows[meta.id];
    if (!found) return meta.id === entry.meta.id && target === month ? entry.usageCents : 0;
    return invoiceUsage(found, invoiceWindow(meta.closingDay, meta.dueDay, target));
  };

  const values = months.map((candidate) => usageFor(entry.meta, candidate));
  const usage = values[activeIndex];
  const window = invoiceWindow(entry.meta.closingDay, entry.meta.dueDay, activeMonth);
  const lines = list ? invoiceLines(list, window) : [];
  const canScroll = cards.length > 1;

  const scrollToCard = (next: number) => {
    const clamped = Math.min(Math.max(0, next), cards.length - 1);
    setActiveCard(clamped);
    trackRef.current?.scrollTo({ left: clamped * (CARD_WIDTH + CARD_GAP), behavior: "smooth" });
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.round(track.scrollLeft / (CARD_WIDTH + CARD_GAP));
    if (next !== activeCard) setActiveCard(next);
  };

  return (
    <article className="card cards-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.cards")}</h2>
        </div>
        <div className="cards-controls">
          <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.cardTitle")}>
            <Icon name="plus" size={16} />
          </button>
          {canScroll ? (
            <>
              <button
                type="button"
                className="round-button"
                disabled={index === 0}
                onClick={() => scrollToCard(index - 1)}
                aria-label={t("planner.previousCard")}
              >
                <Icon name="chevron-left" size={18} />
              </button>
              <button
                type="button"
                className="round-button"
                disabled={index === cards.length - 1}
                onClick={() => scrollToCard(index + 1)}
                aria-label={t("planner.nextCard")}
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </>
          ) : null}
        </div>
        <CardArt />
      </header>

      <div className="card-figure">
        <strong>{formatCents(usage)}</strong>
        <span className="muted small">
          {t("planner.invoiceOf", { month: monthShort(activeMonth, lang) })}
        </span>
      </div>

      <button type="button" className="outline-button" onClick={() => setInvoiceOpen(true)}>
        <Icon name="file-text" size={16} />
        {t("planner.viewInvoice")}
      </button>

      <div className="cards-track" ref={trackRef} onScroll={onScroll}>
        {cards.map(({ meta }) => {
          const state = invoiceWindow(meta.closingDay, meta.dueDay, activeMonth);
          const open = state.to >= today;
          const cardUsage = usageFor(meta, activeMonth);
          return (
            <button
              key={meta.id}
              type="button"
              className="credit-card"
              style={{ "--card-color": meta.color } as CSSProperties}
              onClick={() => onEdit(meta)}
            >
              <span className="credit-texture" aria-hidden="true" />
              <span className="credit-top">
                <span className="credit-brand">{meta.brand || t("planner.card")}</span>
                <span className="credit-state">{open ? t("planner.open") : t("planner.closed")}</span>
              </span>
              <span className="credit-middle">
                <svg className="credit-chip" width="34" height="26" viewBox="0 0 34 26" aria-hidden="true">
                  <defs>
                    <linearGradient id={`chip-${meta.id}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#f6e3ab" />
                      <stop offset="0.5" stopColor="#d9b86c" />
                      <stop offset="1" stopColor="#b18f43" />
                    </linearGradient>
                  </defs>
                  <rect width="34" height="26" rx="5" fill={`url(#chip-${meta.id})`} />
                  <path
                    d="M0 9h11M0 17h11M23 0v26M11 9h12v8H11z"
                    fill="none"
                    stroke="rgba(90, 66, 20, 0.45)"
                    strokeWidth="1"
                  />
                </svg>
                <span className="credit-number">•••• {meta.last4 || "0000"}</span>
                <Icon name="contactless" size={18} strokeWidth={1.5} />
              </span>
              <span className="credit-bottom">
                <span className="credit-field">
                  <em>{t("planner.due")}</em>
                  <b>{formatDate(dateInMonth(activeMonth, meta.dueDay)).slice(0, 5)}</b>
                </span>
                <span className="credit-field end">
                  <em>{t("planner.freeLimit")}</em>
                  <b>{formatCents(Math.max(0, meta.limitCents - cardUsage))}</b>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <UpcomingInvoices
        months={months}
        values={values}
        activeIndex={activeIndex}
        onSelect={setMonthIndex}
      />

      {invoiceOpen ? (
        <InvoiceDialog
          card={entry.meta}
          month={activeMonth}
          window={window}
          dueDate={dateInMonth(activeMonth, entry.meta.dueDay)}
          lines={lines}
          totalCents={usage}
          onClose={() => setInvoiceOpen(false)}
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
}

export function HousingCard({ plan, scope, onScope, onEdit }: HousingProps) {
  const { t } = useLanguage();
  const ratioPct = scope === "primary" ? plan.housingRatioPrimaryPct : plan.housingRatioPct;
  const ratio = Math.min(100, ratioPct);
  const over = ratioPct > plan.ceilingPct;
  return (
    <article className="card housing-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.housing")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onEdit} aria-label={t("planner.housingCeiling")}>
          <Icon name="settings" size={15} />
        </button>
        <HouseArt />
      </header>

      <div className="card-figure">
        <strong>{formatCents(plan.housingCents)}</strong>
        <span className={over ? "delta-line down" : "delta-line"}>
          <Icon name="check" size={14} />
          {t("planner.housingRatio", { percent: ratioPct, ceiling: plan.ceilingPct })}
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
    </article>
  );
}

export function GoalsCard({ plan, onAdd }: { plan: MonthPlan; onAdd: () => void }) {
  const { t } = useLanguage();
  return (
    <article className="card goals-card card-with-art">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("planner.goals")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.goalTitle")}>
          <Icon name="plus" size={16} />
        </button>
        <TargetArt />
      </header>

      {plan.goals.length === 0 ? (
        <p className="card-empty">{t("planner.noGoals")}</p>
      ) : (
        <ul className="goal-list">
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
