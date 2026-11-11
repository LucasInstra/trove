import { linePath } from "../../domain/chart";

/**
 * A trailing trend without axes: the shape is the message. Used inside KPI
 * tiles, where a full chart would drown the number.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = "line",
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "line" | "up" | "down";
  label: string;
}) {
  if (values.length < 2) return null;
  return (
    <svg
      className={`spark spark-${tone}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <path d={linePath(values, width, height, 3)} />
    </svg>
  );
}
