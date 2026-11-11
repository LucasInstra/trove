import { Icon } from "../components/Icons";
import { DailyChart } from "../components/charts/DailyChart";
import { BalanceLine } from "../components/charts/BalanceLine";
import { averageOf, projectCash } from "../domain/forecast";
import { trailing } from "../domain/chart";
import type { MonthPlan } from "../domain/projection";
import { formatCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import type { DailyPoint, MonthPoint } from "../lib/api";
import { useState } from "react";

interface FlowProps {
  series: MonthPoint[];
  daily: DailyPoint[];
  paceCents: number | null;
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
export function FlowScreen({ series, daily, paceCents, plan, month, onSelectMonth }: FlowProps) {
  const { lang, t } = useLanguage();
  const [horizon, setHorizon] = useState<3 | 6 | 12>(6);
  const peak = Math.max(...series.map((point) => Math.max(point.incomeCents, point.expenseCents)), 1);
  const rows = buildRows(series, plan);
  const windowed = trailing(series, 6);
  const forecast = projectCash(
    month,
    rows.find((row) => row.month === month)?.running ?? 0,
    averageOf(windowed.map((point) => point.incomeCents)),
    averageOf(windowed.map((point) => point.expenseCents)),
    horizon,
  );

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

      <article className="card flow-chart">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate"><Icon name="trend" size={15} /></span>
            <h2>{t("chart.dailyBurn")}</h2>
          </div>
          <span className="muted">{monthLabel(month, lang)}</span>
        </header>
        <DailyChart daily={daily} effectiveCents={paceCents} />
      </article>

      <article className="card flow-chart">
        <header className="card-head">
          <div className="card-title">
            <span className="card-icon slate"><Icon name="hourglass" size={15} /></span>
            <h2>{t("forecast.title")}</h2>
          </div>
          <div className="segmented" role="group" aria-label={t("forecast.title")}>
            {([3, 6, 12] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={horizon === option ? "active" : undefined}
                aria-pressed={horizon === option}
                onClick={() => setHorizon(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </header>
        {forecast.length > 0 ? (
          <BalanceLine
            net={forecast.map((point, index, all) =>
              index === 0
                ? point.balanceCents - (rows.find((row) => row.month === month)?.running ?? 0)
                : point.balanceCents - all[index - 1].balanceCents,
            )}
            startCents={rows.find((row) => row.month === month)?.running ?? 0}
          />
        ) : null}
        <p className="muted small">
          {t("forecast.note", {
            end: forecast.length > 0 ? monthLabel(forecast[forecast.length - 1].month, lang) : "",
            balance:
              forecast.length > 0 ? formatCents(forecast[forecast.length - 1].balanceCents) : "",
          })}
        </p>
      </article>

      <article className="card flow-table-card">
        <header className="card-head">
          <h2>{t("flow.table")}</h2>
        </header>
        <div className="flow-scroll">
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
        </div>
        <p className="muted small">{t("flow.note")}</p>
      </article>
    </section>
  );
}
