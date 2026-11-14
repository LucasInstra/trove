import { useState, type PointerEvent } from "react";
import { linePath, pointsOf } from "../../domain/chart";

/**
 * A trailing trend without axes: the shape is the message. Used inside KPI
 * tiles, where a full chart would drown the number. With `labels` and
 * `format` it also answers "what was that month": a dot follows the pointer
 * and a tip names the month and its value.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = "line",
  label,
  labels,
  format,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "line" | "up" | "down";
  label: string;
  labels?: string[];
  format?: (value: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (values.length < 2) return null;
  const line = linePath(values, width, height, 3);
  const points = pointsOf(values, width, height, 3);
  const interactive = labels !== undefined && format !== undefined;

  const track = (event: PointerEvent<HTMLSpanElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setActive(Math.round(ratio * (values.length - 1)));
  };

  const point = active === null ? null : points[active];
  const leftPct = point ? (point[0] / width) * 100 : 0;
  const align = leftPct < 22 ? "start" : leftPct > 78 ? "end" : "mid";

  return (
    <span
      className="spark-wrap"
      onPointerMove={interactive ? track : undefined}
      onPointerLeave={interactive ? () => setActive(null) : undefined}
    >
      <svg
        className={`spark spark-${tone}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        <path className="spark-area" d={`${line} V ${height} H 3 Z`} />
        <path className="spark-line" pathLength={1} d={line} />
      </svg>
      {interactive && point && active !== null ? (
        <>
          <span
            className="spark-dot"
            style={{ left: `${leftPct}%`, top: `${(point[1] / height) * 100}%` }}
            aria-hidden="true"
          />
          <span
            className={`chart-tip spark-tip ${align}`}
            role="tooltip"
            style={{ left: `${leftPct}%` }}
          >
            <strong>{labels[active]}</strong>
            <span className="tip-row">
              {label}
              <b>{format(values[active])}</b>
            </span>
          </span>
        </>
      ) : null}
    </span>
  );
}
