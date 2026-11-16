import { useState } from "react";
import { useLanguage } from "../../lib/language";

export interface BarListRow {
  label: string;
  value: number;
  /** Text for the value; the share of the total follows it. */
  display: string;
  color: string;
}

/** Keeps the biggest `max - 1` rows and folds the tail into one grey "others (N)" row. */
export function foldRows(rows: BarListRow[], max: number, others: string, format: (value: number) => string): BarListRow[] {
  if (rows.length <= max) return rows;
  const rest = rows.slice(max - 1);
  const value = rest.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  return [...rows.slice(0, max - 1), { label: `${others} (${rest.length})`, value, display: format(value), color: "#94a3b8" }];
}

/** The "show all N / show fewer" button under a folded list. */
export function ShowAll({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="outline-button show-all" aria-expanded={open} onClick={onToggle}>
      {open ? t("investments.sheet.showLess") : t("investments.sheet.showAll", { count })}
    </button>
  );
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
  max,
  others,
  format,
}: {
  rows: BarListRow[];
  label: string;
  /** Row the pointer is on (here or on the donut); the others step back. */
  active?: number | null;
  onHover?: (index: number | null) => void;
  /** With these three, a long list folds its tail into "others" and offers a button to see everything. */
  max?: number;
  others?: string;
  format?: (value: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const foldable = max !== undefined && others !== undefined && format !== undefined && rows.length > max;
  const all = rows;
  if (foldable && !open) rows = foldRows(rows, max, others, format);
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  const peak = Math.max(...rows.map((row) => row.value), 1);
  return (
    <>
    <ul className={`barlist${foldable && open ? " is-scroll" : ""}`} aria-label={label}>
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
    {foldable ? <ShowAll open={open} count={all.length} onToggle={() => setOpen((value) => !value)} /> : null}
    </>
  );
}
