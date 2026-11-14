import { useMemo, useState } from "react";
import { CreditCardArt } from "../components/CreditCardArt";
import { Dialog } from "../components/Dialog";
import { HousingCard, SplitCard } from "../components/PlannerCards";
import { parseCents } from "../components/PlannerDialogs";
import { ScoreCard } from "../components/ScoreCard";
import { Icon } from "../components/Icons";
import { useScreenFrame } from "../components/SectionPage";
import { cardLimitUsage, summarizeCards, summarizeGoals } from "../domain/planner";
import { freeToSpend, paceOf } from "../domain/budgets";
import { detectRecurring } from "../domain/recurrence";
import { buildMonthlyReport } from "../domain/report";
import { healthSignals, reserveMonths, type HealthStatus } from "../domain/health";
import { installmentEndMonth, remainingInstallments } from "../domain/installment";
import { netWorthCurve, holdingsTotal, totalWealth } from "../domain/patrimony";
import { retirementProjection } from "../domain/retirement";
import type { MonthPlan } from "../domain/projection";
import type { CSSProperties } from "react";
import type {
  Bill,
  BudgetStatus,
  CardMeta,
  Category,
  CategoryTotal,
  Goal,
  Holding,
  HoldingInput,
  Income,
  MonthPoint,
  MonthTotals,
  Person,
  RecurrenceRow,
  Share,
} from "../lib/api";
import {
  formatCents,
  formatDate,
  monthLabel,
  monthName,
  monthShort,
  todayIso,
} from "../lib/format";
import { categoryName } from "../lib/i18n";
import { useLanguage } from "../lib/language";

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  const frame = useScreenFrame();
  return (
    <header className="planner-screen-head">
      <div className="planner-screen-title">
        {(frame?.eyebrow ?? eyebrow) !== title ? (
          <span className="eyebrow">{frame?.eyebrow ?? eyebrow}</span>
        ) : null}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action ? (
        <button type="button" className="primary" onClick={action.onClick}>
          <Icon name="plus" size={16} />
          {action.label}
        </button>
      ) : null}
      {frame?.tabs ? <div className="planner-screen-tabs">{frame.tabs}</div> : null}
    </header>
  );
}

function EmptyList({ label, action }: { label: string; action: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="empty planner-empty">
      <span className="planner-empty-icon">
        <Icon name="plus" size={20} />
      </span>
      <strong>{label}</strong>
      <button type="button" className="outline-button" onClick={action}>
        <Icon name="plus" size={15} />
        {t("common.addFirst")}
      </button>
    </div>
  );
}

export function CardsScreen({
  cards,
  month,
  onAdd,
  onEdit,
  onMove,
}: {
  cards: { meta: CardMeta; usageCents: number; window: { from: string; to: string } }[];
  month: string;
  onAdd: () => void;
  onEdit: (card: CardMeta) => void;
  onMove: (id: number, delta: -1 | 1) => void;
}) {
  const { lang, t } = useLanguage();
  const summary = summarizeCards(cards);

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("planner.section")}
        title={t("nav.cards")}
        description={t("planner.cardsDescription")}
        action={{ label: t("planner.addCard"), onClick: onAdd }}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">
            {t("planner.invoiceOf", { month: monthName(month, lang) })}
          </span>
          <strong className="metric-value">{formatCents(summary.invoiceCents)}</strong>
          <span className="metric-note">{cards.length === 1 ? t("planner.cardsCountOne") : t("planner.cardsCount", { count: cards.length })}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("planner.totalLimit")}</span>
          <strong className="metric-value">{formatCents(summary.limitCents)}</strong>
          <span className="metric-note">
            {cards.length === 1 ? t("planner.limitAcrossCardsOne") : t("planner.limitAcrossCards", { count: cards.length })}
          </span>
        </article>
      </div>

      {cards.length === 0 ? (
        <EmptyList label={t("planner.noCards")} action={onAdd} />
      ) : (
        <div className="entity-list">
          {cards.map(({ meta, usageCents }, position) => {
            const { availableCents, usedPct } = cardLimitUsage(meta, usageCents);
            return (
              <article
                className="entity-card entity-card-credit credit-entity"
                key={meta.id}
                style={{ "--entity-color": meta.color } as CSSProperties}
              >
                <CreditCardArt meta={meta} />
                <div className="entity-main">
                  <div className="entity-title-row">
                    <div>
                      <h2>{meta.brand || t("planner.card")}</h2>
                      <span className="muted small">
                        {meta.accountName} · ···· {meta.last4 || "0000"}
                      </span>
                    </div>
                    <div className="entity-actions">
                      <button
                        type="button"
                        className="round-button"
                        disabled={position === 0}
                        aria-label={t("planner.moveCardUp")}
                        title={t("planner.moveCardUp")}
                        onClick={() => onMove(meta.id, -1)}
                      >
                        <Icon name="chevron-up" size={16} />
                      </button>
                      <button
                        type="button"
                        className="round-button"
                        disabled={position === cards.length - 1}
                        aria-label={t("planner.moveCardDown")}
                        title={t("planner.moveCardDown")}
                        onClick={() => onMove(meta.id, 1)}
                      >
                        <Icon name="chevron-down" size={16} />
                      </button>
                      <button
                        type="button"
                        className="outline-button entity-edit"
                        onClick={() => onEdit(meta)}
                      >
                        {t("common.edit")}
                      </button>
                    </div>
                  </div>
                  <div className="entity-figures">
                    <span>
                      <small>{t("planner.invoiceOf", { month: monthName(month, lang) })}</small>
                      <strong>{formatCents(usageCents)}</strong>
                    </span>
                    <span>
                      <small>{t("planner.freeLimit")}</small>
                      <strong>{formatCents(availableCents)}</strong>
                    </span>
                    <span>
                      <small>{t("planner.limit")}</small>
                      <strong>{formatCents(meta.limitCents)}</strong>
                    </span>
                  </div>
                  <div
                    className="meter-track slim"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(usedPct)}
                    aria-label={t("planner.limitUsed", { percent: Math.round(usedPct) })}
                  >
                    <div
                      className="meter-fill"
                      style={{ width: `${Math.max(usedPct, usedPct > 0 ? 2 : 0)}%`, background: "var(--entity-color, var(--primary))" }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
          <button type="button" className="empty-add" onClick={onAdd}>
            <Icon name="plus" size={18} />
            {t("planner.addCard")}
          </button>
        </div>
      )}
    </section>
  );
}

export function ReserveScreen({
  plan,
  onAdd,
  onEdit,
  onDeposit,
}: {
  plan: MonthPlan;
  onAdd: () => void;
  onEdit: (goal: Goal) => void;
  onDeposit: (goal: Goal) => void;
}) {
  const { t } = useLanguage();
  const summary = summarizeGoals(plan.goals);

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("planner.section")}
        title={t("nav.reserve")}
        description={t("planner.reserveDescription")}
        action={{ label: t("planner.addGoal"), onClick: onAdd }}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("planner.monthlyContribution")}</span>
          <strong className="metric-value">{formatCents(summary.monthlyCents)}</strong>
          <span className="metric-note">{t("layout.goalCount", { count: plan.goals.length })}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("planner.savedSoFar")}</span>
          <strong className="metric-value">{formatCents(summary.savedCents)}</strong>
          <span className="metric-note">
            {t("planner.acrossGoals", { count: plan.goals.length })}
          </span>
        </article>
      </div>

      {plan.goals.length === 0 ? (
        <EmptyList label={t("planner.noGoals")} action={onAdd} />
      ) : (
        <div className="entity-list">
          {plan.goals.map(({ goal, paidCents, sharePct }) => (
            <article
              className="entity-card entity-card-goal"
              key={goal.id}
              style={{ "--entity-color": goal.color } as CSSProperties}
            >
              <div className="entity-icon goal-mark">
                <Icon name="target" size={19} />
              </div>
              <div className="entity-main">
                <div className="entity-title-row">
                  <div>
                    <h2>{goal.name}</h2>
                    <span className="muted small">
                      {t("planner.goalProgress", { percent: Math.round(sharePct) })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="outline-button entity-edit"
                    onClick={() => onDeposit(goal)}
                  >
                    {t("deposit.button")}
                  </button>
                  <button
                    type="button"
                    className="outline-button entity-edit"
                    onClick={() => onEdit(goal)}
                  >
                    {t("common.edit")}
                  </button>
                </div>
                <div
                  className="meter-track goal-meter"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(sharePct)}
                  aria-label={t("planner.goalProgress", { percent: Math.round(sharePct) })}
                >
                  <div
                    className="meter-fill"
                    style={{ width: `${sharePct}%`, background: "var(--entity-color)" }}
                  />
                </div>
                <div className="entity-figures">
                  <span>
                    <small>{t("planner.savedSoFar")}</small>
                    <strong>{formatCents(paidCents)}</strong>
                  </span>
                  <span>
                    <small>{t("planner.target")}</small>
                    <strong>{formatCents(goal.targetCents)}</strong>
                  </span>
                  <span>
                    <small>{t("planner.monthly")}</small>
                    <strong>{formatCents(goal.monthlyCents)}</strong>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function HouseScreen({
  plan,
  categories,
  housingCategoryId,
  housingScope,
  people,
  shares,
  splitSettled,
  onCategory,
  onScope,
  onEditCeiling,
  onAddBill,
  onEditBill,
  onAssign,
  onSettle,
}: {
  plan: MonthPlan;
  categories: Category[];
  housingCategoryId: number | null;
  housingScope: "primary" | "total";
  people: Person[];
  shares: Share[];
  splitSettled: boolean;
  onCategory: (categoryId: number | null) => void;
  onScope: (scope: "primary" | "total") => void;
  onEditCeiling: () => void;
  onAddBill: () => void;
  onEditBill: (bill: Bill) => void;
  onAssign: (billId: number, personId: number) => void;
  onSettle: () => void;
}) {
  const { t } = useLanguage();
  const housingBills = plan.housingBills;

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("planner.section")}
        title={t("nav.house")}
        description={t("planner.houseDescription")}
      />
      <article className="card house-settings-card">
        <div className="house-settings-copy">
          <h2>{t("planner.housingCategory")}</h2>
          <span className="muted small">
            {t("planner.housingHint", {
              category:
                categories.find((item) => item.id === housingCategoryId)?.name ??
                t("planner.housing"),
            })}
          </span>
        </div>
        <label className="field house-category-field">
          <span>{t("planner.category")}</span>
          <select
            value={housingCategoryId ?? ""}
            onChange={(event) => onCategory(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">{t("ledger.noCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryName(t, category.name)}
              </option>
            ))}
          </select>
        </label>
      </article>

      <div className="house-overview-grid">
        <HousingCard plan={plan} scope={housingScope} onScope={onScope} onEdit={onEditCeiling} />
        {housingBills.length > 0 ? (
          <article className="card rent-card">
            <header className="card-head">
              <div className="card-title">
                <h2>{t("planner.rentAndBills")}</h2>
              </div>
              <button
                type="button"
                className="round-button"
                onClick={onAddBill}
                aria-label={t("planner.newBill")}
              >
                <Icon name="plus" size={16} />
              </button>
            </header>
            <ul className="bill-list">
              {housingBills.map((bill) => (
                <li className="bill" key={bill.id}>
                  <span className="bill-check">
                    <span className="bill-dot" style={{ background: "var(--primary)" }} />
                    <button
                      type="button"
                      className="link bill-name"
                      onClick={() => onEditBill(bill)}
                    >
                      {bill.name}
                    </button>
                  </span>
                  <span className="bill-amount">{formatCents(bill.amountCents)}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="outline-button" onClick={onAddBill}>
              <Icon name="plus" size={15} />
              {t("planner.addHousingBill")}
            </button>
          </article>
        ) : (
          <article className="card house-empty-card">
            <div className="planner-empty-icon">
              <Icon name="home" size={21} />
            </div>
            <div>
              <h2>{t("planner.noHousingBills")}</h2>
              <p className="muted small">{t("planner.noHousingBillsHint")}</p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={onAddBill}
              disabled={housingCategoryId === null}
              title={housingCategoryId === null ? t("planner.pickHousingCategory") : undefined}
            >
              <Icon name="plus" size={16} />
              {t("planner.addHousingBill")}
            </button>
          </article>
        )}
      </div>

      {people.length > 1 ? (
        <SplitCard
          people={people}
          shares={shares}
          bills={housingBills}
          settled={splitSettled}
          onAssign={onAssign}
          onSettle={onSettle}
        />
      ) : (
        <article className="card house-split-empty">
          <span className="entity-icon">
            <Icon name="scale" size={19} />
          </span>
          <div>
            <h2>{t("split.title")}</h2>
            <p className="muted small">{t("split.noPartner")}</p>
          </div>
        </article>
      )}
    </section>
  );
}

export function PatrimonyScreen({
  plan,
  series,
  month,
  holdings,
  onSaveHolding,
  onDeleteHolding,
}: {
  plan: MonthPlan;
  series: MonthPoint[];
  month: string;
  holdings: Holding[];
  onSaveHolding: (input: HoldingInput) => void;
  onDeleteHolding: (id: number) => void;
}) {
  const { lang, t } = useLanguage();
  const [dialog, setDialog] = useState<{ holding: Holding | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Holding | null>(null);
  const summary = summarizeGoals(plan.goals);
  const curve = netWorthCurve(series.slice(-12));
  const accumulated = curve.at(-1)?.runningCents ?? 0;
  const holdingsCents = holdingsTotal(holdings);
  const total = totalWealth(summary.savedCents, accumulated, holdingsCents);

  const width = 600;
  const height = 220;
  const pad = { left: 8, right: 8, top: 12, bottom: 22 };
  const values = curve.map((point) => point.runningCents);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const x = (index: number) =>
    curve.length < 2
      ? width / 2
      : pad.left + (index * (width - pad.left - pad.right)) / (curve.length - 1);
  const y = (value: number) =>
    pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);
  const line = curve
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.runningCents)}`)
    .join(" ");
  const area = `${line} L${x(curve.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z`;

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.strategyGroup")}
        title={t("nav.patrimony")}
        description={t("patrimony.description")}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("planner.savedSoFar")}</span>
          <strong className="metric-value">{formatCents(summary.savedCents)}</strong>
          <span className="metric-note">
            {t("planner.acrossGoals", { count: plan.goals.length })}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">{t("planner.monthlyContribution")}</span>
          <strong className="metric-value">{formatCents(summary.monthlyCents)}</strong>
          <span className="metric-note">{t("flow.running")}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("patrimony.accumulated")}</span>
          <strong className="metric-value">{formatCents(accumulated)}</strong>
          <span className="metric-note">{monthLabel(month, lang)}</span>
        </article>
      </div>

      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate">
              <Icon name="bank" size={15} />
            </span>
            <h2>{t("holdings.title")}</h2>
          </div>
          <span className="muted">{t("holdings.total", { amount: formatCents(total) })}</span>
        </header>
        <p className="muted small">{t("holdings.desc")}</p>
        {holdings.length > 0 ? (
          <ul className="installment-list">
            {holdings.map((holding) => (
              <li key={holding.id} className="installment">
                <div className="installment-head">
                  <span className="installment-name">{holding.name}</span>
                  <span className="muted small">
                    {t(`holdings.kind_${holding.kind}`)} · {formatCents(holding.amountCents)}
                  </span>
                  <span className="tx-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title={t("common.edit")}
                      aria-label={`${t("common.edit")}: ${holding.name}`}
                      onClick={() => setDialog({ holding })}
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      title={t("common.delete")}
                      aria-label={`${t("common.delete")}: ${holding.name}`}
                      onClick={() => setConfirmDelete(holding)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </span>
                </div>
                <span className="muted small">
                  {t("holdings.updatedOn", { date: formatDate(holding.updatedOn) })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card-empty">{t("holdings.empty")}</p>
        )}
        <div className="row">
          <button
            type="button"
            className="outline-button small-button"
            onClick={() => setDialog({ holding: null })}
          >
            <Icon name="plus" size={14} />
            {t("holdings.new")}
          </button>
        </div>
      </article>

      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate">
              <Icon name="bank" size={15} />
            </span>
            <h2>{t("patrimony.curve")}</h2>
          </div>
        </header>
        {curve.length === 0 ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="wealth-curve"
              role="img"
              aria-label={t("patrimony.curve")}
            >
              <path d={area} fill="var(--primary)" fillOpacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {min < 0 && max > 0 ? (
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(0)}
                  y2={y(0)}
                  stroke="var(--line-strong)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ) : null}
              {curve.map((point, index) => (
                <circle
                  key={point.month}
                  cx={x(index)}
                  cy={y(point.runningCents)}
                  r={3.5}
                  fill="var(--primary)"
                >
                  <title>{`${monthLabel(point.month, lang)}: ${formatCents(point.runningCents)}`}</title>
                </circle>
              ))}
              <text x={pad.left} y={height - 6} fontSize={11} fill="var(--muted)">
                {monthShort(curve[0].month, lang)}
              </text>
              <text
                x={width - pad.right}
                y={height - 6}
                fontSize={11}
                fill="var(--muted)"
                textAnchor="end"
              >
                {monthShort(curve[curve.length - 1].month, lang)}
              </text>
            </svg>
            <p className="muted small">{t("patrimony.note")}</p>
          </>
        )}
      </article>

      {dialog ? (
        <HoldingDialog
          initial={dialog.holding}
          onClose={() => setDialog(null)}
          onSave={(input) => {
            onSaveHolding(input);
            setDialog(null);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog
          title={t("holdings.confirmDeleteTitle", { name: confirmDelete.name })}
          onClose={() => setConfirmDelete(null)}
        >
          <p className="muted">{t("holdings.confirmDeleteDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onDeleteHolding(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}

const HOLDING_KINDS = ["cash", "investment", "property", "other"] as const;

function HoldingDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: Holding | null;
  onClose: () => void;
  onSave: (input: HoldingInput) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<(typeof HOLDING_KINDS)[number]>(initial?.kind ?? "other");
  const [amount, setAmount] = useState(initial ? (initial.amountCents / 100).toFixed(2) : "");
  const [updatedOn, setUpdatedOn] = useState(initial?.updatedOn ?? todayIso());

  return (
    <Dialog title={initial ? t("holdings.edit") : t("holdings.new")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === "") return;
          const cents = parseCents(amount);
          if (!updatedOn) return;
          onSave({
            id: initial?.id ?? null,
            name: name.trim(),
            kind,
            amountCents: cents,
            updatedOn,
          });
        }}
      >
        <label className="field">
          <span>{t("planner.name")}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>{t("holdings.kind")}</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              {HOLDING_KINDS.map((option) => (
                <option key={option} value={option}>
                  {t(`holdings.kind_${option}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("planner.amount")}</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              required
            />
          </label>
        </div>
        <label className="field">
          <span>{t("holdings.updatedOnLabel")}</span>
          <input
            type="date"
            value={updatedOn}
            onChange={(event) => setUpdatedOn(event.target.value)}
            required
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function RetirementScreen({ plan }: { plan: MonthPlan }) {
  const { t } = useLanguage();
  const summary = summarizeGoals(plan.goals);
  const reserveMonthly = plan.goals
    .filter((entry) => entry.goal.kind === "reserve")
    .reduce((sum, entry) => sum + entry.goal.monthlyCents, 0);
  const [monthly, setMonthly] = useState((reserveMonthly / 100).toFixed(2));
  const [years, setYears] = useState("20");
  const [rate, setRate] = useState("6");

  const monthlyCents = parseCents(monthly);
  const yearsCount = Math.max(0, Math.floor(Number(years) || 0));
  const ratePct = Math.max(0, Number(String(rate).replace(",", ".")) || 0);
  const curve = retirementProjection({
    currentCents: summary.savedCents,
    monthlyCents,
    years: yearsCount,
    annualRatePct: ratePct,
  });
  const last = curve.at(-1);

  const width = 600;
  const height = 220;
  const pad = { left: 8, right: 8, top: 12, bottom: 22 };
  const values = curve.map((point) => point.balanceCents);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const x = (index: number) =>
    curve.length < 2
      ? width / 2
      : pad.left + (index * (width - pad.left - pad.right)) / (curve.length - 1);
  const y = (value: number) =>
    pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);
  const line = curve
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.balanceCents)}`)
    .join(" ");
  const area = `${line} L${x(curve.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z`;

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.strategyGroup")}
        title={t("nav.retirement")}
        description={t("retirement.description")}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("planner.savedSoFar")}</span>
          <strong className="metric-value">{formatCents(summary.savedCents)}</strong>
          <span className="metric-note">
            {t("planner.acrossGoals", { count: plan.goals.length })}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">{t("retirement.monthly")}</span>
          <strong className="metric-value">{formatCents(monthlyCents)}</strong>
          <span className="metric-note">{t("retirement.perMonth")}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("retirement.projected")}</span>
          <strong className="metric-value">{formatCents(last?.balanceCents ?? 0)}</strong>
          <span className="metric-note">{t("retirement.inYears", { count: yearsCount })}</span>
        </article>
      </div>

      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate">
              <Icon name="hourglass" size={15} />
            </span>
            <h2>{t("retirement.simulate")}</h2>
          </div>
        </header>
        <div className="retire-form">
          <label className="field">
            <span>{t("retirement.monthly")}</span>
            <input
              value={monthly}
              onChange={(event) => setMonthly(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="field">
            <span>{t("retirement.years")}</span>
            <input
              type="number"
              min={0}
              value={years}
              onChange={(event) => setYears(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t("retirement.rate")}</span>
            <input
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
      </article>

      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate">
              <Icon name="trend" size={15} />
            </span>
            <h2>{t("retirement.curve")}</h2>
          </div>
        </header>
        {curve.length < 2 || (last?.balanceCents ?? 0) <= 0 ? (
          <p className="card-empty">{t("retirement.empty")}</p>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="wealth-curve"
              role="img"
              aria-label={t("retirement.curve")}
            >
              <path d={area} fill="var(--primary)" fillOpacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              {curve.map((point, index) =>
                index % Math.ceil(curve.length / 6) === 0 || index === curve.length - 1 ? (
                  <g key={point.year}>
                    <circle cx={x(index)} cy={y(point.balanceCents)} r={3.5} fill="var(--primary)">
                      <title>{`${t("retirement.year", { count: point.year })}: ${formatCents(point.balanceCents)}`}</title>
                    </circle>
                  </g>
                ) : null,
              )}
              <text x={pad.left} y={height - 6} fontSize={11} fill="var(--muted)">
                {t("retirement.today")}
              </text>
              <text
                x={width - pad.right}
                y={height - 6}
                fontSize={11}
                fill="var(--muted)"
                textAnchor="end"
              >
                {t("retirement.inYears", { count: yearsCount })}
              </text>
            </svg>
            <p className="muted small">{t("retirement.note")}</p>
          </>
        )}
      </article>
    </section>
  );
}

const HEALTH_TONE: Record<HealthStatus, string> = {
  ok: "var(--positive)",
  warn: "var(--warning)",
  bad: "var(--negative)",
};

export function HealthScreen({
  plan,
  byCategory,
  totals,
  month,
  status,
  history,
}: {
  plan: MonthPlan;
  byCategory: CategoryTotal[];
  totals: MonthTotals | null;
  month: string;
  status: BudgetStatus | null;
  history: RecurrenceRow[];
}) {
  const { lang, t } = useLanguage();
  const today = todayIso();
  const recurring = useMemo(() => detectRecurring(history, month), [history, month]);
  const report =
    totals != null
      ? buildMonthlyReport({ month, todayYmd: today, totals, byCategory, status, recurring })
      : null;
  const [copied, setCopied] = useState(false);
  const signals = healthSignals(plan, byCategory);
  const overBudgets = byCategory.filter(
    (item) => item.budgetCents != null && item.totalCents > item.budgetCents,
  ).length;
  const details: Record<string, string> = {
    bills: t("health.billsDetail", { paid: plan.paidBillIds.length, count: plan.dueBills.length }),
    margin: t("health.marginDetail", { amount: formatCents(plan.forecastCents) }),
    reserve: t("health.reserveDetail", { months: reserveMonths(plan) }),
    housing:
      plan.housingCents === 0
        ? t("health.noHousing")
        : t("health.housingDetail", { percent: Math.round(plan.housingRatioPct) }),
    budgets:
      overBudgets === 0 ? t("health.budgetsOk") : t("health.budgetsDetail", { count: overBudgets }),
  };
  const titles: Record<string, string> = {
    bills: t("health.bills"),
    margin: t("health.margin"),
    reserve: t("health.reserve"),
    housing: t("health.housing"),
    budgets: t("health.budgets"),
  };

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.strategyGroup")}
        title={t("nav.health")}
        description={t("health.description")}
      />
      <ScoreCard plan={plan} />
      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate">
              <Icon name="scale" size={15} />
            </span>
            <h2>{t("health.checklist")}</h2>
          </div>
        </header>
        <ul className="installment-list">
          {signals.map((signal) => (
            <li key={signal.id} className="installment">
              <div className="installment-head">
                <span className="installment-name">
                  <span className="dot" style={{ background: HEALTH_TONE[signal.status] }} />
                  {titles[signal.id]}
                </span>
                <span className="muted small">{details[signal.id]}</span>
              </div>
              <div className="meter-track slim">
                <div
                  className="meter-fill"
                  style={{
                    width: `${signal.share * 100}%`,
                    background: HEALTH_TONE[signal.status],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </article>

      {report ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate">
                <Icon name="file-text" size={15} />
              </span>
              <h2>{t("report.title")}</h2>
            </div>
            <span className="muted">{monthLabel(month, lang)}</span>
          </header>
          <div className="installment-head">
            <span className="installment-name">{t("flow.balance")}</span>
            <span className="muted small">
              {t("report.balanceLine", {
                income: formatCents(report.incomeCents),
                expense: formatCents(report.expenseCents),
                balance: formatCents(report.balanceCents),
              })}
            </span>
          </div>
          <div className="installment-head">
            <span className="installment-name">{t("report.saved")}</span>
            <span className="muted small">
              {report.savingsRatePct !== null
                ? t("report.savedPct", { percent: report.savingsRatePct })
                : t("report.noSavings")}
            </span>
          </div>
          {report.top.length > 0 ? (
            <ul className="installment-list">
              {report.top.map((item) => (
                <li key={item.name} className="installment">
                  <div className="installment-head">
                    <span className="installment-name">{categoryName(t, item.name)}</span>
                    <span className="muted small">
                      {formatCents(item.totalCents)}
                      {item.effectiveCents != null
                        ? ` / ${formatCents(item.effectiveCents)}`
                        : null}
                      {item.pace === "over" ? ` · ${t("budgets.paceOver")}` : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {report.freeCents !== null && report.globalEffectiveCents !== null ? (
            <p className="muted small">
              {t("report.freeLine", {
                amount: formatCents(report.freeCents),
                effective: formatCents(report.globalEffectiveCents),
              })}
            </p>
          ) : null}
          {report.recurring.length > 0 ? (
            <ul className="installment-list">
              {report.recurring.map((charge) => (
                <li key={`${charge.label}-${charge.amountCents}`} className="installment">
                  <div className="installment-head">
                    <span className="installment-name">{charge.label}</span>
                    <span
                      className={charge.status === "overdue" ? "muted small over" : "muted small"}
                    >
                      {t(`recurrence.${charge.status}`, {
                        month: monthLabel(charge.nextMonth, lang),
                        day: charge.dayOfMonth,
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="row">
            <button
              type="button"
              className="outline-button small-button"
              onClick={() => {
                const lines = [
                  `${monthLabel(month, lang)} · ${t("report.title")}`,
                  t("report.balanceLine", {
                    income: formatCents(report.incomeCents),
                    expense: formatCents(report.expenseCents),
                    balance: formatCents(report.balanceCents),
                  }),
                  report.savingsRatePct !== null
                    ? t("report.savedPct", { percent: report.savingsRatePct })
                    : t("report.noSavings"),
                  ...report.top.map(
                    (item) =>
                      `${categoryName(t, item.name)}: ${formatCents(item.totalCents)}${item.effectiveCents != null ? ` / ${formatCents(item.effectiveCents)}` : ""}`,
                  ),
                  ...(report.freeCents !== null && report.globalEffectiveCents !== null
                    ? [
                        t("report.freeLine", {
                          amount: formatCents(report.freeCents),
                          effective: formatCents(report.globalEffectiveCents),
                        }),
                      ]
                    : []),
                ];
                const text = lines.join("\n");
                const done = () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                };
                if (navigator.clipboard?.writeText) {
                  void navigator.clipboard.writeText(text).then(done).catch(done);
                } else {
                  done();
                }
              }}
            >
              {copied ? t("report.copied") : t("report.copy")}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}

export function FlowsScreen({
  incomes,
  totals,
  byCategory,
  month,
  status,
  onAddIncome,
  onEditIncome,
  onEditBudget,
  onSaveGlobal,
}: {
  incomes: Income[];
  totals: MonthTotals | null;
  byCategory: CategoryTotal[];
  month: string;
  status: BudgetStatus | null;
  onAddIncome: () => void;
  onEditIncome: (income: Income) => void;
  onEditBudget: (category: { id: number; name: string; budget: number | null }) => void;
  onSaveGlobal: (limit: number | null, carryover: boolean) => void;
}) {
  const { lang, t } = useLanguage();
  const incomeCents = totals?.incomeCents ?? 0;
  const expenseCents = totals?.expenseCents ?? 0;
  const ranked = [...byCategory].sort((left, right) => right.totalCents - left.totalCents);
  const peak = Math.max(...ranked.map((item) => item.totalCents), 1);
  const today = todayIso();
  const lines = new Map((status?.lines ?? []).map((line) => [line.categoryId, line]));
  const free = freeToSpend(expenseCents, status?.global?.effectiveCents ?? null);
  const [capOpen, setCapOpen] = useState(false);
  const [capRaw, setCapRaw] = useState("");
  const [capCarry, setCapCarry] = useState(false);

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.strategyGroup")}
        title={t("nav.flows")}
        description={t("flows.description")}
        action={{ label: t("planner.addIncome"), onClick: onAddIncome }}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("flow.in")}</span>
          <strong className="metric-value">{formatCents(incomeCents)}</strong>
          <span className="metric-note">
            {t("planner.incomeSources", { count: incomes.filter((entry) => entry.active).length })}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">{t("flow.out")}</span>
          <strong className="metric-value">{formatCents(expenseCents)}</strong>
          <span className="metric-note">{monthLabel(month, lang)}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("flow.balance")}</span>
          <strong className="metric-value">{formatCents(incomeCents - expenseCents)}</strong>
          <span className="metric-note">{monthLabel(month, lang)}</span>
        </article>
      </div>

      <div className="planner-pair">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate">
                <Icon name="target" size={15} />
              </span>
              <h2>{t("budgets.freeTitle")}</h2>
            </div>
            <span className="muted">{monthLabel(month, lang)}</span>
          </header>
          {status?.global && free !== null ? (
            <>
              <strong className="metric-value">{formatCents(free)}</strong>
              <span className="muted small">
                {t("budgets.freeNote", {
                  remaining: formatCents(free),
                  effective: formatCents(status.global.effectiveCents),
                  perDay: formatCents(
                    paceOf(expenseCents, status.global.effectiveCents, today, month).perDayCents,
                  ),
                })}
                {status.global.carryInCents > 0
                  ? ` · ${t("budgets.carryIn", { amount: formatCents(status.global.carryInCents) })}`
                  : null}
              </span>
            </>
          ) : (
            <>
              <p className="muted">{t("budgets.noCapHint")}</p>
              <span className="muted small">{t("budgets.noCap")}</span>
            </>
          )}
          {capOpen ? (
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                if (capRaw.trim() === "") {
                  onSaveGlobal(null, false);
                  setCapOpen(false);
                  return;
                }
                const cents = parseCents(capRaw);
                if (cents <= 0) return;
                onSaveGlobal(cents, capCarry);
                setCapOpen(false);
              }}
            >
              <input
                value={capRaw}
                onChange={(event) => setCapRaw(event.target.value)}
                inputMode="decimal"
                placeholder={t("budget.none")}
                aria-label={t("budgets.setCap")}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={capCarry}
                  onChange={(event) => setCapCarry(event.target.checked)}
                />
                {t("budgets.carryover")}
              </label>
              <button type="submit" className="primary">
                {t("common.save")}
              </button>
            </form>
          ) : (
            <div>
              <button
                type="button"
                className="outline-button small-button"
                onClick={() => {
                  setCapRaw(status?.global ? (status.global.limitCents / 100).toFixed(2) : "");
                  setCapCarry(status?.global?.carryover ?? false);
                  setCapOpen(true);
                }}
              >
                {status?.global ? t("budgets.editCap") : t("budgets.setCap")}
              </button>
            </div>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate">
                <Icon name="trend" size={15} />
              </span>
              <h2>{t("flows.incomeTitle")}</h2>
            </div>
          </header>
          {incomes.length === 0 ? (
            <EmptyList label={t("planner.noIncome")} action={onAddIncome} />
          ) : (
            <ul className="installment-list">
              {incomes.map((income) => (
                <li key={income.id} className="installment">
                  <div className="installment-head">
                    <span className="installment-name">{income.name}</span>
                    <span className="muted small">{formatCents(income.amountCents)}</span>
                  </div>
                  <span className="muted small">
                    {t("planner.payDayLabel", { day: income.payDay })} ·{" "}
                    {income.active ? t("planner.active") : t("planner.inactive")}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="outline-button small-button"
                      onClick={() => onEditIncome(income)}
                    >
                      {t("common.edit")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate">
              <Icon name="ledger" size={15} />
            </span>
            <h2>{t("flows.byCategory")}</h2>
          </div>
          <span className="muted">{monthLabel(month, lang)}</span>
        </header>
        {ranked.length === 0 ? (
          <p className="card-empty">{t("ledger.noSpending")}</p>
        ) : (
          <ul className="installment-list">
            {ranked.map((item) => {
              const line = item.categoryId != null ? lines.get(item.categoryId) : undefined;
              const cap = line?.effectiveCents ?? item.budgetCents ?? null;
              const over = cap != null && item.totalCents > cap;
              const pct =
                cap != null
                  ? Math.min(100, (item.totalCents / cap) * 100)
                  : (item.totalCents / peak) * 100;
              const pace =
                line != null ? paceOf(line.spentCents, line.effectiveCents, today, month) : null;
              const paceKey =
                pace?.status === "over"
                  ? "budgets.paceOver"
                  : pace?.status === "watch"
                    ? "budgets.paceWatch"
                    : pace != null
                      ? "budgets.paceOk"
                      : null;
              const row = (
                <>
                  <div className="installment-head">
                    <span className="installment-name">
                      <span className="dot" style={{ background: item.color }} />
                      {categoryName(t, item.name)}
                      {line?.overridden ? (
                        <em className="pill-soft">{t("budgets.overridden")}</em>
                      ) : null}
                    </span>
                    <span className={over ? "muted small over" : "muted small"}>
                      {formatCents(item.totalCents)}
                      {cap != null ? ` / ${formatCents(cap)}` : null}
                    </span>
                  </div>
                  <div className="meter-track slim">
                    <div
                      className={over ? "meter-fill over" : "meter-fill"}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                  {paceKey && pace ? (
                    <span className="muted small">
                      {t(paceKey)} · {formatCents(pace.remainingCents)} ·{" "}
                      {t("budgets.perDay", { amount: formatCents(pace.perDayCents) })}
                      {line && line.carryInCents > 0
                        ? ` · ${t("budgets.carryIn", { amount: formatCents(line.carryInCents) })}`
                        : null}
                    </span>
                  ) : null}
                </>
              );
              return (
                <li key={item.categoryId ?? item.name} className="installment">
                  {item.categoryId == null ? (
                    row
                  ) : (
                    <button
                      type="button"
                      className="legend-edit"
                      onClick={() =>
                        onEditBudget({
                          id: item.categoryId as number,
                          name: item.name,
                          budget: item.budgetCents,
                        })
                      }
                      aria-label={t("budget.title", { name: categoryName(t, item.name) })}
                    >
                      {row}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}

export function DebtsScreen({
  plan,
  cards,
  month,
  history,
  onEditBill,
}: {
  plan: MonthPlan;
  cards: Array<{ meta: CardMeta; usageCents: number }>;
  month: string;
  history: RecurrenceRow[];
  onEditBill: (bill: Bill) => void;
}) {
  const { lang, t } = useLanguage();
  const recurring = useMemo(() => detectRecurring(history, month), [history, month]);
  const installments = plan.dueBills.flatMap((bill) => {
    const current = remainingInstallments(bill, month);
    const ends = installmentEndMonth(bill);
    return current && ends ? [{ bill, ...current, ends }] : [];
  });
  const leftCents = installments.reduce((sum, entry) => sum + entry.leftCents, 0);
  const openInvoices = cards.filter((entry) => entry.usageCents > 0);
  const openCents = openInvoices.reduce((sum, entry) => sum + entry.usageCents, 0);
  const lastPayoff =
    installments
      .map((entry) => entry.ends)
      .sort()
      .at(-1) ?? null;

  const empty = installments.length === 0 && openInvoices.length === 0;

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.strategyGroup")}
        title={t("nav.debts")}
        description={t("debts.description")}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("debts.remaining")}</span>
          <strong className="metric-value">{formatCents(leftCents)}</strong>
          <span className="metric-note">
            {t("planner.installmentsCount", { count: installments.length })}
          </span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">{t("debts.openInvoices")}</span>
          <strong className="metric-value">{formatCents(openCents)}</strong>
          <span className="metric-note">{monthLabel(month, lang)}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("debts.lastPayoff")}</span>
          <strong className="metric-value">{lastPayoff ? monthName(lastPayoff, lang) : "—"}</strong>
          <span className="metric-note">{lastPayoff ?? t("debts.empty")}</span>
        </article>
      </div>

      {empty ? (
        <article className="card">
          <p className="card-empty">{t("debts.empty")}</p>
        </article>
      ) : null}

      {installments.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate">
                <Icon name="file-text" size={15} />
              </span>
              <h2>{t("planner.installments")}</h2>
            </div>
          </header>
          <ul className="installment-list">
            {installments.map(({ bill, left, leftCents: leftValue, ends }) => {
              const current = bill.installmentsTotal
                ? Math.floor(bill.installmentsTotal) - left
                : 0;
              return (
                <li key={bill.id} className="installment">
                  <div className="installment-head">
                    <span className="installment-name">{bill.name}</span>
                    <span className="muted small">
                      {current}/{bill.installmentsTotal} · {formatCents(bill.amountCents)}
                    </span>
                    <button
                      type="button"
                      className="outline-button small-button"
                      onClick={() => onEditBill(bill)}
                    >
                      {t("common.edit")}
                    </button>
                  </div>
                  <div className="meter-track slim">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${bill.installmentsTotal ? (current / Math.floor(bill.installmentsTotal)) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="muted small">
                    {t("debts.leftToGo", { left, amount: formatCents(leftValue) })} ·{" "}
                    {t("debts.payoff", { month: monthLabel(ends, lang) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      ) : null}

      {openInvoices.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate">
                <Icon name="card" size={15} />
              </span>
              <h2>{t("debts.openInvoicesTitle")}</h2>
            </div>
          </header>
          <ul className="installment-list">
            {openInvoices.map(({ meta, usageCents }) => (
              <li key={meta.id} className="installment">
                <div className="installment-head">
                  <span className="installment-name">
                    {meta.brand || t("planner.card")} •••• {meta.last4 || "0000"}
                  </span>
                  <span className="muted small">{formatCents(usageCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {recurring.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <span className="card-icon slate">
                <Icon name="swap" size={15} />
              </span>
              <h2>{t("recurrence.title")}</h2>
            </div>
            <span className="muted">{t("recurrence.subtitle")}</span>
          </header>
          <ul className="installment-list">
            {recurring.map((charge) => (
              <li key={`${charge.label}-${charge.amountCents}`} className="installment">
                <div className="installment-head">
                  <span className="installment-name">{charge.label}</span>
                  <span className="muted small">{formatCents(charge.amountCents)}</span>
                </div>
                <span className={charge.status === "overdue" ? "muted small over" : "muted small"}>
                  {t(`recurrence.${charge.status}`, {
                    month: monthLabel(charge.nextMonth, lang),
                    day: charge.dayOfMonth,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
