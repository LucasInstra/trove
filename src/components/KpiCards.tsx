import { Icon3D } from "./Icon3D";
import { Money } from "./Money";
import { Sparkline } from "./charts/Sparkline";
import { computeKpis, type KpiDatum } from "../domain/kpis";
import { trailing } from "../domain/chart";
import type { MonthPlan } from "../domain/projection";
import type { MonthPoint } from "../lib/api";
import { formatCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";

function Delta({ datum, prevLabel, invert = false }: { datum: KpiDatum; prevLabel: string | null; invert?: boolean }) {
  const { lang, t } = useLanguage();
  if (datum.deltaPct === null || prevLabel === null) return null;
  // Spending up is bad news, so the tone flips for the expense tile.
  const good = invert ? datum.deltaPct <= 0 : datum.deltaPct >= 0;
  const pct = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    maximumFractionDigits: 1,
  });
  const sign = datum.deltaPct > 0 ? "+" : "";
  return (
    <span className={good ? "delta-line" : "delta-line down"}>
      {sign}
      {pct.format(datum.deltaPct)}% · {t("kpi.vsPrev", { month: prevLabel })}
    </span>
  );
}

function Tile({
  label,
  datum,
  prevLabel,
  invert = false,
  spark = null,
  sparkMonths,
  tone = "line",
  hint,
}: {
  label: string;
  datum: KpiDatum;
  prevLabel: string | null;
  invert?: boolean;
  spark?: number[] | null;
  sparkMonths?: string[];
  tone?: "line" | "up" | "down";
  hint?: string;
}) {
  return (
    <div className="kpi" title={hint}>
      <span className="kpi-label">{label}</span>
      <Money cents={datum.valueCents} className="kpi-value" />
      <Delta datum={datum} prevLabel={prevLabel} invert={invert} />
      {spark && spark.length >= 4 ? <Sparkline
          values={spark}
          tone={tone}
          label={label}
          labels={sparkMonths}
          format={sparkMonths ? formatCents : undefined}
        /> : null}
    </div>
  );
}

/**
 * The month at a glance: in, out and balance with the change against the
 * previous month. Spending up reads as bad, the other two as good.
 */
export function KpisCard({
  plan,
  series,
  month,
  compact = false,
  span = 3,
}: {
  plan: MonthPlan;
  series: MonthPoint[];
  month: string;
  compact?: boolean;
  span?: number;
}) {
  const { lang, t } = useLanguage();
  const kpis = computeKpis(plan, series, month);
  const prevLabel = kpis.prevMonth ? monthShort(kpis.prevMonth, lang) : null;
  const trail = 6;
  const sparkMonths = trailing(series.map((point) => point.month), trail).map((value) => monthLabel(value, lang));
  const incomeSpark = trailing(series.map((point) => point.incomeCents), trail);
  const expenseSpark = trailing(series.map((point) => point.expenseCents), trail);
  const balanceSpark = trailing(
    series.map((point) => point.incomeCents - point.expenseCents),
    trail,
  );

  if (compact) {
    return (
      <article className="card card-compact">
        <div className="compact-head">
          <Icon3D name="chart-up" size={22} />
          <span className="compact-title">{t("kpi.balance")}</span>
          <span className="compact-value">{formatCents(kpis.balance.valueCents)}</span>
        </div>
        <div className="compact-body">
          <Delta datum={kpis.balance} prevLabel={prevLabel} />
        </div>
      </article>
    );
  }

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <Icon3D name="chart-up" size={30} />
          <h2>{t("kpi.title")}</h2>
        </div>
      </header>
      <div className={span < 3 ? "kpi-grid is-two" : "kpi-grid"}>
        <Tile label={t("kpi.income")} datum={kpis.income} prevLabel={prevLabel} spark={incomeSpark} sparkMonths={sparkMonths} tone="up" />
        <Tile label={t("kpi.expense")} datum={kpis.expense} prevLabel={prevLabel} invert spark={expenseSpark} sparkMonths={sparkMonths} tone="down" />
        <Tile label={t("kpi.balance")} datum={kpis.balance} prevLabel={prevLabel} spark={balanceSpark} sparkMonths={sparkMonths} />
        <Tile label={t("kpi.freed")} datum={kpis.freed} prevLabel={null} hint={t("kpi.freedHint")} />
      </div>
    </article>
  );
}
