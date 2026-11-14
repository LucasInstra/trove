import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useChartWidth } from "../../hooks/useChartWidth";
import { niceMax } from "../../domain/chart";
import { useLanguage } from "../../lib/language";

const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const GUTTER = 44;

/** "R$ 1,2 mil" / "R$ 3,4 mi": axis labels have no room for cents. */
function axisLabel(cents: number, lang: string): string {
  const value = cents / 100;
  const text = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
  return text;
}

export interface LineChartProps {
  values: number[];
  /** A dashed reference line over the same x positions, such as a pace. */
  reference?: number[];
  /** One label per point; the chart thins them to what fits. */
  labels: string[];
  height?: number;
  ariaLabel: string;
  /** What the tooltip says for the point under the pointer. */
  tip: (index: number) => ReactNode;
}

/**
 * A line chart drawn in real pixels with an axis, a zero line when the series
 * crosses it, and a scrubber: hover (or arrow keys) lands on the nearest point
 * and a tooltip says what is there. Values may be negative.
 */
export function LineChart({ values, reference, labels, height = 180, ariaLabel, tip }: LineChartProps) {
  const { lang } = useLanguage();
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradient = useId();

  const all = [...values, ...(reference ?? [])];
  const rawMax = Math.max(...all, 0);
  const rawMin = Math.min(...all, 0);
  const top = rawMax > 0 ? niceMax(rawMax) : 0;
  const bottom = rawMin < 0 ? -niceMax(-rawMin) : 0;
  const span = top - bottom || 1;

  const left = GUTTER;
  const plotWidth = Math.max(1, width - left - PAD_X);
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const x = (index: number) =>
    values.length < 2 ? left + plotWidth / 2 : left + (index * plotWidth) / (values.length - 1);
  const y = (value: number) => PAD_TOP + ((top - value) / span) * plotHeight;

  const pathOf = (series: number[]) =>
    series.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ");
  const line = pathOf(values);
  const baseline = y(Math.max(bottom, Math.min(0, top)));
  const area = values.length
    ? `${line} L${x(values.length - 1)},${baseline} L${x(0)},${baseline} Z`
    : "";

  const gridValues = [top, bottom < 0 ? 0 : top / 2, bottom < 0 ? bottom : 0].filter(
    (value, index, list) => list.indexOf(value) === index,
  );

  // Thin the x labels so they never touch: about 56px each.
  const every = Math.max(1, Math.ceil(values.length / Math.max(2, Math.floor(plotWidth / 56))));

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (values.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left - left;
    const step = values.length < 2 ? 1 : plotWidth / (values.length - 1);
    setActive(Math.max(0, Math.min(values.length - 1, Math.round(px / step))));
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (values.length === 0) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setActive((current) =>
        Math.max(0, Math.min(values.length - 1, (current ?? values.length - 1) + delta)),
      );
    } else if (event.key === "Escape") {
      setActive(null);
    }
  };

  const tipX = active === null ? 0 : Math.max(88, Math.min(width - 88, x(active)));

  return (
    <div
      className="chart-box line-chart"
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      onPointerMove={move}
      onPointerLeave={() => setActive(null)}
      onKeyDown={key}
      onBlur={() => setActive(null)}
    >
      <svg className="chart-svg" width={width} height={height} aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - PAD_X}
              y1={y(value)}
              y2={y(value)}
              className={value === 0 && bottom < 0 ? "chart-zero" : "chart-grid"}
            />
            <text x={left - 8} y={y(value) + 3.5} textAnchor="end" className="chart-tick">
              {axisLabel(value, lang)}
            </text>
          </g>
        ))}
        {reference ? <path d={pathOf(reference)} className="chart-pace" /> : null}
        {area ? <path d={area} fill={`url(#${gradient})`} stroke="none" /> : null}
        <path d={line} className="chart-line" />
        {labels.map((label, index) =>
          index % every === 0 || index === labels.length - 1 ? (
            <text
              key={`${label}-${index}`}
              x={x(index)}
              y={height - 6}
              textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
              className="chart-tick"
            >
              {label}
            </text>
          ) : null,
        )}
        {active !== null ? (
          <g className="chart-cursor">
            <line x1={x(active)} x2={x(active)} y1={PAD_TOP} y2={height - PAD_BOTTOM} />
            {reference ? <circle cx={x(active)} cy={y(reference[active] ?? 0)} r={3.5} className="chart-dot-ref" /> : null}
            <circle cx={x(active)} cy={y(values[active])} r={5} className="chart-dot" />
          </g>
        ) : values.length > 0 ? (
          <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3.5} className="chart-dot" />
        ) : null}
      </svg>
      {active !== null ? (
        <div className="chart-tip" role="status" style={{ left: tipX, top: Math.max(0, y(values[active]) - 12) }}>
          {tip(active)}
        </div>
      ) : null}
    </div>
  );
}
