import { cumulative } from "../../domain/chart";
import { formatCents } from "../../lib/format";
import { useLanguage } from "../../lib/language";
import type { DailyPoint } from "../../lib/api";
import { LineChart } from "./LineChart";

/**
 * Daily burn for one month: cumulative spending as a filled area against a
 * dashed pace line (the cap spread evenly over the days). Refunds bend the
 * area back down, exactly like they bend the totals.
 */
export function DailyChart({
  daily,
  effectiveCents,
}: {
  daily: DailyPoint[];
  effectiveCents: number | null;
}) {
  const { t } = useLanguage();
  const spent = cumulative(daily.map((point) => point.expenseCents));
  const days = daily.length;
  const pace =
    effectiveCents !== null && days > 0
      ? daily.map((_, index) => Math.floor((effectiveCents * (index + 1)) / days))
      : null;
  const peak = Math.max(...spent, ...(pace ?? []), 0);

  return (
    <div className="daily-chart">
      {spent.length > 0 ? (
        <LineChart
          values={spent}
          reference={pace ?? undefined}
          labels={daily.map((_, index) => String(index + 1))}
          height={190}
          ariaLabel={t("chart.dailyBurn")}
          tip={(index) => {
            const over = pace ? spent[index] - pace[index] : null;
            return (
              <>
                <strong>{t("chart.day", { day: index + 1 })}</strong>
                <span className="tip-row">
                  <i className="chart-swatch spend" />
                  {t("chart.spent")}
                  <b>{formatCents(spent[index])}</b>
                </span>
                <span className="tip-row muted">
                  {t("chart.thatDay")}
                  <b>{formatCents(daily[index].expenseCents)}</b>
                </span>
                {pace && over !== null ? (
                  <span className="tip-row muted">
                    <i className="chart-swatch pace" />
                    {t("chart.pace")}
                    <b className={over > 0 ? "negative" : "positive"}>
                      {over > 0 ? "+" : ""}
                      {formatCents(over)}
                    </b>
                  </span>
                ) : null}
              </>
            );
          }}
        />
      ) : null}
      <div className="chart-legend">
        <span>
          <i className="chart-swatch spend" />
          {t("chart.spent")} · {formatCents(peak)}
        </span>
        {pace && effectiveCents !== null ? (
          <span>
            <i className="chart-swatch pace" />
            {t("chart.pace")} · {formatCents(effectiveCents)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
