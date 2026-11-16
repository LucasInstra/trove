export interface BarListRow {
  label: string;
  value: number;
  /** Text for the value; the share of the total follows it. */
  display: string;
  color: string;
}

/**
 * A ranked list of horizontal bars: the label on the left, a bar scaled to the
 * biggest row, then the value and its share. Reads better than a thin stacked
 * bar once there are more than three or four parts.
 */
export function BarList({
  rows,
  label,
  active = null,
  onHover,
}: {
  rows: BarListRow[];
  label: string;
  /** Row the pointer is on (here or on the donut); the others step back. */
  active?: number | null;
  onHover?: (index: number | null) => void;
}) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  const peak = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="barlist" aria-label={label}>
      {rows.map((row, index) => (
        <li
          key={row.label}
          className={`barlist-row${active !== null && active !== index ? " dim" : ""}${active === index ? " on" : ""}`}
          data-tip={`${row.label}: ${row.display}`}
          onMouseEnter={onHover ? () => onHover(index) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
        >
          <span className="barlist-label">{row.label}</span>
          <span className="barlist-track">
            <i style={{ width: `${Math.max(2, (Math.max(0, row.value) / peak) * 100)}%`, background: row.color }} />
          </span>
          <span className="barlist-value">
            {row.display}
            <small>{total > 0 ? `${Math.round((Math.max(0, row.value) / total) * 100)}%` : "0%"}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
