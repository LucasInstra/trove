import { Icon } from "../components/Icons";
import type { MonthPlan } from "../domain/projection";
import { formatCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import type { MonthPoint } from "../lib/api";

interface FlowProps {
  series: MonthPoint[];
  plan: MonthPlan;
  month: string;
  onSelectMonth: (month: string) => void;
}

interface FlowRow extends MonthPoint {
  expense: number;
  balance: number;
  running: number;
  isPlanned: boolean;
}

/** Pure: the running balance is accumulated outside the render pass. */
function buildRows(series: MonthPoint[], plan: MonthPlan): FlowRow[] {
  let running = 0;
  return series.map((point) => {
    const isPlanned = point.month === plan.month && plan.hasPlan;
    const expense = isPlanned ? plan.plannedCents : point.expenseCents;
    const balance = point.incomeCents - expense;
    running += balance;
    return { ...point, expense, balance, running, isPlanned };
  });
}

/** Twelve months of money in and out, with the running balance. */
export function FlowScreen({ series, plan, month, onSelectMonth }: FlowProps) {
  const { lang, t } = useLanguage();
  const peak = Math.max(...series.map((point) => Math.max(point.incomeCents, point.expenseCents)), 1);
  const rows = buildRows(series, plan);

  return (
    <section className="screen flow-screen">
      <article className="card flow-chart">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate"><Icon name="flow" size={15} /></span>
            <h2>{t("flow.title")}</h2>
          </div>
          <span className="muted">{t("flow.subtitle")}</span>
        </header>

        <div className="flow-bars">
          {rows.map((row) => (
            <button
              type="button"
              key={row.month}
              className={row.month === month ? "flow-col current" : "flow-col"}
              onClick={() => onSelectMonth(row.month)}
              aria-current={row.month === month}
              title={`${monthLabel(row.month, lang)} · ${t("flow.in")}: ${formatCents(row.incomeCents)} · ${t("flow.out")}: ${formatCents(row.expense)} · ${t("flow.balance")}: ${formatCents(row.balance)}`}
            >
              <span className="flow-pair">
                <span
                  className="flow-bar in"
                  style={{ height: `${Math.max(2, (row.incomeCents / peak) * 100)}%` }}
                  title={`${t("flow.in")}: ${formatCents(row.incomeCents)}`}
                />
                <span
                  className={row.isPlanned ? "flow-bar out planned" : "flow-bar out"}
                  style={{ height: `${Math.max(2, (row.expense / peak) * 100)}%` }}
                  title={`${t("flow.out")}: ${formatCents(row.expense)}`}
                />
              </span>
              <span className="flow-label">{monthShort(row.month, lang)}</span>
            </button>
          ))}
        </div>

        <div className="flow-legend">
          <span><i className="flow-swatch in" />{t("flow.in")}</span>
          <span><i className="flow-swatch out" />{t("flow.out")}</span>
          <span><i className="flow-swatch planned" />{t("flow.planned")}</span>
        </div>
      </article>

      <article className="card flow-table-card">
        <header className="card-head">
          <h2>{t("flow.table")}</h2>
        </header>
        <table className="flow-table">
          <thead>
            <tr>
              <th>{t("flow.month")}</th>
              <th>{t("flow.in")}</th>
              <th>{t("flow.out")}</th>
              <th>{t("flow.balance")}</th>
              <th>{t("flow.running")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month} className={row.month === month ? "current" : undefined}>
                <td>{monthLabel(row.month, lang)}</td>
                <td>{formatCents(row.incomeCents)}</td>
                <td>{formatCents(row.expense)}</td>
                <td className={row.balance < 0 ? "negative" : "positive"}>{formatCents(row.balance)}</td>
                <td>{formatCents(row.running)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">{t("flow.note")}</p>
      </article>
    </section>
  );
}
