import type { Bill, CardMeta, Goal } from "../lib/api";
import type { InvoiceWindow } from "../domain/invoice";
import type { MonthPlan } from "../domain/projection";
import { formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

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
    <article className="card bills-card">
      <header className="card-head">
        <div className="card-title">
          <span className="card-icon brass"><Icon name="file" size={15} /></span>
          <h2>{t("planner.bills")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.newBill")}>
          <Icon name="plus" size={15} />
        </button>
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
  onAdd: () => void;
  onEdit: (card: CardMeta) => void;
}

export function CardsCard({ cards, onAdd, onEdit }: CardsProps) {
  const { t } = useLanguage();
  const invoice = cards.reduce((total, entry) => total + entry.usageCents, 0);
  const free = cards.reduce(
    (total, entry) => total + Math.max(0, entry.meta.limitCents - entry.usageCents),
    0,
  );

  return (
    <article className="card cards-card">
      <header className="card-head">
        <div className="card-title">
          <span className="card-icon sky"><Icon name="card" size={15} /></span>
          <h2>{t("planner.cards")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.cardTitle")}>
          <Icon name="plus" size={15} />
        </button>
      </header>

      {cards.length === 0 ? (
        <p className="card-empty">{t("planner.noCards")}</p>
      ) : (
        <>
          <div className="card-figure">
            <strong>{formatCents(invoice)}</strong>
            <span className="muted small">{t("planner.invoiceOf")}</span>
          </div>
          <div className="card-carousel">
            {cards.map(({ meta, usageCents }) => (
              <button
                key={meta.id}
                type="button"
                className="credit-card"
                style={{ background: meta.color }}
                onClick={() => onEdit(meta)}
              >
                <span className="credit-top">
                  <span className="credit-brand">{meta.brand || t("planner.card")}</span>
                  <span className="credit-chip" />
                </span>
                <span className="credit-number">•••• {meta.last4 || "0000"}</span>
                <span className="credit-bottom">
                  <span>
                    <em>{t("planner.invoice")}</em>
                    {formatCents(usageCents)}
                  </span>
                  <span>
                    <em>{t("planner.free")}</em>
                    {formatCents(Math.max(0, meta.limitCents - usageCents))}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="muted small">{t("planner.limitFree", { amount: formatCents(free) })}</p>
        </>
      )}
    </article>
  );
}

export function HousingCard({ plan, onEdit }: { plan: MonthPlan; onEdit: () => void }) {
  const { t } = useLanguage();
  const ratio = Math.min(100, plan.housingRatioPct);
  return (
    <article className="card housing-card">
      <header className="card-head">
        <div className="card-title">
          <span className="card-icon clay"><Icon name="home" size={15} /></span>
          <h2>{t("planner.housing")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onEdit} aria-label={t("planner.housingCeiling")}>
          <Icon name="settings" size={15} />
        </button>
      </header>

      <div className="card-figure">
        <strong>{formatCents(plan.housingCents)}</strong>
        <span className={plan.overCeiling ? "delta-line down" : "delta-line"}>
          <Icon name="check" size={14} />
          {t("planner.housingRatio", { percent: plan.housingRatioPct, ceiling: plan.ceilingPct })}
        </span>
      </div>

      <div className="meter">
        <div className="meter-track">
          <div
            className={plan.overCeiling ? "meter-fill over" : "meter-fill"}
            style={{ width: `${ratio}%` }}
          />
          <span className="meter-mark" style={{ left: `${Math.min(100, plan.ceilingPct)}%` }} />
        </div>
        <div className="meter-scale">
          <span>0%</span>
          <span>{plan.ceilingPct}%</span>
          <span>100%</span>
        </div>
      </div>
    </article>
  );
}

export function GoalsCard({ plan, onAdd }: { plan: MonthPlan; onAdd: () => void }) {
  const { t } = useLanguage();
  return (
    <article className="card goals-card">
      <header className="card-head">
        <div className="card-title">
          <span className="card-icon moss"><Icon name="target" size={15} /></span>
          <h2>{t("planner.goals")}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onAdd} aria-label={t("planner.goalTitle")}>
          <Icon name="plus" size={15} />
        </button>
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
