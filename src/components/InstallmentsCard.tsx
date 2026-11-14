import { Icon3D } from "./Icon3D";
import { Money } from "./Money";
import { installmentOf } from "../domain/installment";
import type { MonthPlan } from "../domain/projection";
import { formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";

/**
 * Installment purchases due this month: which parcel each one is on and what
 * is still left to pay. The parcel number derives from the bill, so the card
 * only lists the bills that carry an installment count.
 */
export function InstallmentsCard({
  plan,
  month,
  compact = false,
}: {
  plan: MonthPlan;
  month: string;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const items = plan.dueBills.flatMap((bill) => {
    const installment = installmentOf(bill, month);
    return installment ? [{ bill, installment }] : [];
  });
  const total = items.reduce((sum, entry) => sum + entry.bill.amountCents, 0);

  if (compact) {
    const first = items[0];
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="coin-steps" size={22} />
          <span className="compact-title">
            {first
              ? `${first.bill.name} ${first.installment.current}/${first.installment.total}`
              : t("planner.installments")}
          </span>
          <span className="compact-value">{formatCents(total)}</span>
        </div>
        {first ? (
          <div className="compact-body">
            <span className="muted small">
              {items.length > 1
                ? t("planner.installmentsMore", { count: items.length - 1 })
                : `${first.installment.total - first.installment.current} ${t("planner.installmentsToGo")}`}
            </span>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <Icon3D name="coin-steps" size={30} />
          <h2>{t("planner.installments")}</h2>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="card-empty">{t("planner.installmentsEmpty")}</p>
      ) : (
        <>
          <div className="card-figure">
            <Money cents={total} />
          </div>
          <ul className="installment-list">
            {items.map(({ bill, installment }) => {
              const left = installment.total - installment.current;
              return (
                <li key={bill.id} className="installment">
                  <div className="installment-head">
                    <span className="installment-name">{bill.name}</span>
                    <span className="muted small">
                      {installment.current}/{installment.total}
                    </span>
                  </div>
                  <div className="meter-track slim">
                    <div
                      className="meter-fill"
                      style={{ width: `${(installment.current / installment.total) * 100}%` }}
                    />
                  </div>
                  <span className="muted small">
                    {left > 0
                      ? `${left} ${t("planner.installmentsToGo")} · ${formatCents(left * bill.amountCents)}`
                      : t("planner.installmentsLast")}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}
