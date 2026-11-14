import { cumulative } from "../../domain/chart";
import { formatCents, monthLabel, monthShort } from "../../lib/format";
import { useLanguage } from "../../lib/language";
import { LineChart } from "./LineChart";

/**
 * Where the last months are heading: the running net (in minus out)
 * accumulated across the window. Bars show each month; this line shows the
 * trajectory, so a slow bleed reads as a slope, not as twelve calm bars.
 * `startCents` lifts the whole line, which is how forecasts reuse it. With
 * `months` the axis and the tooltip name each point.
 */
export function BalanceLine({
  net,
  startCents = 0,
  months,
}: {
  net: number[];
  startCents?: number;
  months?: string[];
}) {
  const { lang, t } = useLanguage();
  const running = cumulative(net).map((value) => value + startCents);
  const last = running[running.length - 1] ?? startCents;
  const labels = running.map((_, index) =>
    months?.[index] ? monthShort(months[index], lang) : String(index + 1),
  );

  return (
    <div className="balance-line">
      {running.length > 1 ? (
        <LineChart
          values={running}
          labels={labels}
          height={150}
          ariaLabel={t("chart.balanceLine")}
          tip={(index) => (
            <>
              <strong>{months?.[index] ? monthLabel(months[index], lang) : labels[index]}</strong>
              <span className="tip-row">
                <i className="chart-swatch spend" />
                {t("chart.balanceLine")}
                <b>{formatCents(running[index])}</b>
              </span>
              <span className="tip-row muted">
                {t("chart.monthNet")}
                <b className={net[index] < 0 ? "negative" : undefined}>
                  {net[index] > 0 ? "+" : ""}
                  {formatCents(net[index])}
                </b>
              </span>
            </>
          )}
        />
      ) : null}
      <div className="chart-legend">
        <span>
          <i className="chart-swatch spend" />
          {t("chart.balanceLine")} · {formatCents(last)}
        </span>
      </div>
    </div>
  );
}
