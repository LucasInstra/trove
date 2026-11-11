import { HousingCard, SplitCard } from "../components/PlannerCards";
import { Icon } from "../components/Icons";
import {
  activeIncomeCount,
  cardLimitUsage,
  summarizeCards,
  summarizeGoals,
} from "../domain/planner";
import type { MonthPlan } from "../domain/projection";
import type { CSSProperties } from "react";
import type { Bill, CardMeta, Category, Goal, Income, Person, Share } from "../lib/api";
import { formatCents, monthName } from "../lib/format";
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
