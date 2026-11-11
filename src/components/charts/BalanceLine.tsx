import { useChartWidth } from "../../hooks/useChartWidth";
import { areaPath, cumulative, linePath, pointsOf } from "../../domain/chart";
import { formatCents } from "../../lib/format";
import { useLanguage } from "../../lib/language";

const HEIGHT = 120;
const PAD = 8;

/**
 * Where the last months are heading: the running net (in minus out)
 * accumulated across the window. Bars show each month; this line shows the
 * trajectory, so a slow bleed reads as a slope, not as twelve calm bars.
 */
export function BalanceLine({ net }: { net: number[] }) {
  const { t } = useLanguage();
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const running = cumulative(net);
  const last = running[running.length - 1] ?? 0;
  const dots = pointsOf(running, width, HEIGHT, PAD);
  const [dotX, dotY] = dots[dots.length - 1] ?? [width - PAD, HEIGHT - PAD];

  return (
    <div className="chart-box" ref={ref}>
      {running.length > 1 ? (
        <svg
          className="chart-svg"
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t("chart.balanceLine")}
        >
          <path d={areaPath(running, width, HEIGHT, PAD)} className="chart-area" />
          <path d={linePath(running, width, HEIGHT, PAD)} className="chart-line" />
          <circle cx={dotX} cy={dotY} r={3.5} className="chart-dot" />
        </svg>
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
