import { HousingCard, SplitCard } from "../components/PlannerCards";
import { ScoreCard } from "../components/ScoreCard";
import { Icon } from "../components/Icons";
import {
  activeIncomeCount,
  cardLimitUsage,
  summarizeCards,
  summarizeGoals,
} from "../domain/planner";
import { healthSignals, reserveMonths, type HealthStatus } from "../domain/health";
import { netWorthCurve } from "../domain/patrimony";
import type { MonthPlan } from "../domain/projection";
import type { CSSProperties } from "react";
import type { Bill, CardMeta, Category, CategoryTotal, Goal, Income, MonthPoint, MonthTotals, Person, Share } from "../lib/api";
import { formatCents, monthLabel, monthName, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";

function ScreenHeader({
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
  return (
    <header className="planner-screen-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action ? (
        <button type="button" className="primary" onClick={action.onClick}>
          <Icon name="plus" size={16} />
          {action.label}
        </button>
      ) : null}
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
}: {
  cards: { meta: CardMeta; usageCents: number; window: { from: string; to: string } }[];
  month: string;
  onAdd: () => void;
  onEdit: (card: CardMeta) => void;
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
          <span className="metric-note">{t("planner.cardsCount", { count: cards.length })}</span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("planner.totalLimit")}</span>
          <strong className="metric-value">{formatCents(summary.limitCents)}</strong>
          <span className="metric-note">
            {t("planner.limitAcrossCards", { count: cards.length })}
          </span>
        </article>
      </div>

      {cards.length === 0 ? (
        <EmptyList label={t("planner.noCards")} action={onAdd} />
      ) : (
        <div className="entity-list">
          {cards.map(({ meta, usageCents }) => {
            const { availableCents, usedPct } = cardLimitUsage(meta, usageCents);
            return (
              <article
                className="entity-card entity-card-credit"
                key={meta.id}
                style={{ "--entity-color": meta.color } as CSSProperties}
              >
                <div className="entity-icon credit-mark">
                  <Icon name="card" size={19} />
                </div>
                <div className="entity-main">
                  <div className="entity-title-row">
                    <div>
                      <h2>{meta.brand || t("planner.card")}</h2>
                      <span className="muted small">
                        {meta.accountName} · ···· {meta.last4 || "0000"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="outline-button entity-edit"
                      onClick={() => onEdit(meta)}
                    >
                      {t("common.edit")}
                    </button>
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
                      style={{ width: `${usedPct}%`, background: "var(--entity-color)" }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
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
                {category.name}
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

export function IncomeScreen({
  incomes,
  plan,
  onAdd,
  onEdit,
}: {
  incomes: Income[];
  plan: MonthPlan;
  onAdd: () => void;
  onEdit: (income: Income) => void;
}) {
  const { t } = useLanguage();
  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("planner.section")}
        title={t("nav.income")}
        description={t("planner.incomeDescription")}
        action={{ label: t("planner.addIncome"), onClick: onAdd }}
      />
      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("planner.incomeForMonth")}</span>
          <strong className="metric-value">{formatCents(plan.incomeCents)}</strong>
          <span className="metric-note">
            {t("planner.incomeSources", { count: activeIncomeCount(incomes) })}
          </span>
        </article>
      </div>
      {incomes.length === 0 ? (
        <EmptyList label={t("planner.noIncome")} action={onAdd} />
      ) : (
        <div className="entity-list">
          {incomes.map((income) => (
            <article className="entity-card entity-card-income" key={income.id}>
              <div className="entity-icon">
                <Icon name="trend" size={19} />
              </div>
              <div className="entity-main">
                <div className="entity-title-row">
                  <div>
                    <h2>{income.name}</h2>
                    <span className="muted small">
                      {t("planner.payDayLabel", { day: income.payDay })} ·{" "}
                      {income.active ? t("planner.active") : t("planner.inactive")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="outline-button entity-edit"
                    onClick={() => onEdit(income)}
                  >
                    {t("common.edit")}
                  </button>
                </div>
                <strong className="income-amount">{formatCents(income.amountCents)}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function PatrimonyScreen({
  plan,
  series,
  month,
}: {
  plan: MonthPlan;
  series: MonthPoint[];
  month: string;
}) {
  const { lang, t } = useLanguage();
  const summary = summarizeGoals(plan.goals);
  const curve = netWorthCurve(series.slice(-12));
  const accumulated = curve.at(-1)?.runningCents ?? 0;

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
  const line = curve.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.runningCents)}`).join(" ");
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
                <circle key={point.month} cx={x(index)} cy={y(point.runningCents)} r={3.5} fill="var(--primary)">
                  <title>{`${monthLabel(point.month, lang)}: ${formatCents(point.runningCents)}`}</title>
                </circle>
              ))}
              <text x={pad.left} y={height - 6} fontSize={11} fill="var(--muted)">
                {monthShort(curve[0].month, lang)}
              </text>
              <text x={width - pad.right} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
                {monthShort(curve[curve.length - 1].month, lang)}
              </text>
            </svg>
            <p className="muted small">{t("patrimony.note")}</p>
          </>
        )}
      </article>
    </section>
  );
}

const HEALTH_TONE: Record<HealthStatus, string> = {
  ok: "var(--positive)",
  warn: "var(--primary)",
  bad: "var(--negative)",
};

export function HealthScreen({
  plan,
  byCategory,
}: {
  plan: MonthPlan;
  byCategory: CategoryTotal[];
}) {
  const { t } = useLanguage();
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
    </section>
  );
}

export function FlowsScreen({
  incomes,
  totals,
  byCategory,
  month,
  onAddIncome,
  onEditIncome,
  onEditBudget,
}: {
  incomes: Income[];
  totals: MonthTotals | null;
  byCategory: CategoryTotal[];
  month: string;
  onAddIncome: () => void;
  onEditIncome: (income: Income) => void;
  onEditBudget: (category: { id: number; name: string; budget: number | null }) => void;
}) {
  const { lang, t } = useLanguage();
  const incomeCents = totals?.incomeCents ?? 0;
  const expenseCents = totals?.expenseCents ?? 0;
  const ranked = [...byCategory].sort((left, right) => right.totalCents - left.totalCents);
  const peak = Math.max(...ranked.map((item) => item.totalCents), 1);

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
          <span className="metric-note">{t("planner.incomeSources", { count: incomes.filter((entry) => entry.active).length })}</span>
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
              const over = item.budgetCents != null && item.totalCents > item.budgetCents;
              const pct =
                item.budgetCents != null
                  ? Math.min(100, (item.totalCents / item.budgetCents) * 100)
                  : (item.totalCents / peak) * 100;
              const row = (
                <>
                  <div className="installment-head">
                    <span className="installment-name">
                      <span className="dot" style={{ background: item.color }} />
                      {item.name}
                    </span>
                    <span className={over ? "muted small over" : "muted small"}>
                      {formatCents(item.totalCents)}
                      {item.budgetCents != null ? ` / ${formatCents(item.budgetCents)}` : null}
                    </span>
                  </div>
                  <div className="meter-track slim">
                    <div
                      className={over ? "meter-fill over" : "meter-fill"}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
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
                      aria-label={t("budget.title", { name: item.name })}
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
