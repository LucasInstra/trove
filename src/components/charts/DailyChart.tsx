import { useChartWidth } from "../../hooks/useChartWidth";
import { areaPath, cumulative, linePath } from "../../domain/chart";
import { formatCents } from "../../lib/format";
import { useLanguage } from "../../lib/language";
import type { DailyPoint } from "../../lib/api";

const HEIGHT = 180;
const PAD = 8;

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
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const spent = cumulative(daily.map((point) => point.expenseCents));
  const days = daily.length;
  const pace =
    effectiveCents !== null && days > 0
      ? daily.map((_, index) => Math.floor((effectiveCents * (index + 1)) / days))
      : null;
  const peak = Math.max(...spent, ...(pace ?? []), 0);

  return (
    <div className="chart-box" ref={ref}>
      {spent.length > 0 ? (
        <svg
          className="chart-svg"
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t("chart.dailyBurn")}
        >
          {pace ? (
            <path d={linePath(pace, width, HEIGHT, PAD)} className="chart-pace" />
          ) : null}
          <path d={areaPath(spent, width, HEIGHT, PAD)} className="chart-area" />
          <path d={linePath(spent, width, HEIGHT, PAD)} className="chart-line" />
          <text x={PAD} y={HEIGHT - 2} className="chart-tick">
            1
          </text>
          <text x={width / 2} y={HEIGHT - 2} className="chart-tick middle" textAnchor="middle">
            {Math.ceil(days / 2)}
          </text>
          <text x={width - PAD} y={HEIGHT - 2} className="chart-tick" textAnchor="end">
            {days}
          </text>
        </svg>
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
