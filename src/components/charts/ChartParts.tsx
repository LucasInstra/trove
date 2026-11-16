import { useState, type ReactNode } from "react";
import { Donut } from "../Donut";
import { BarList, type BarListRow } from "./BarList";

export function compactMoney(cents: number, lang: string): string {
  return new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

/** A row of headline numbers above the charts. */
export function StatTiles({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <div className="stat-tiles">
      {items.map((item) => (
        <article key={item.label} className="card stat-tile">
          <span className="stat-tile-label">{item.label}</span>
          <strong className="stat-tile-value">{item.value}</strong>
          {item.note ? <span className="stat-tile-note">{item.note}</span> : null}
        </article>
      ))}
    </div>
  );
}

export interface Grouping {
  id: string;
  label: string;
  rows: BarListRow[];
}

/** One card, one donut and list, regrouped by whichever dimension the pills pick. */
export function GroupedDistribution({
  title,
  groupings,
  centerLabel,
  centerValue,
  action,
}: {
  title: string;
  groupings: Grouping[];
  centerLabel: string;
  centerValue: string;
  action?: ReactNode;
}) {
  const [pick, setPick] = useState(groupings[0]?.id ?? "");
  const [hover, setHover] = useState<number | null>(null);
  const current = groupings.find((group) => group.id === pick) ?? groupings[0];
  if (!current) return null;
  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <h2>{title}</h2>
        </div>
        <div className="segmented sheet-seg" role="tablist" aria-label={title}>
          {groupings.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={group.id === current.id}
              className={group.id === current.id ? "active" : ""}
              onClick={() => {
                setPick(group.id);
                setHover(null);
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
        {action}
      </header>
      <div className="sheet-donut">
        <Donut
          segments={current.rows.map((row) => ({ color: row.color, value: row.value }))}
          centerLabel={centerLabel}
          centerValue={centerValue}
          activeIndex={hover}
          onActive={setHover}
        />
        <BarList rows={current.rows} label={current.label} active={hover} onHover={setHover} />
      </div>
    </article>
  );
}

export interface Column {
  key: string;
  cents: number;
  /** Shown under the column when not empty. */
  tick: string;
  tip: string;
}

/** Vertical columns on one axis, with a 3-step scale and a hover tip per column. */
export function ColumnChart({ columns, label, lang }: { columns: Column[]; label: string; lang: string }) {
  const top = Math.max(...columns.map((column) => column.cents), 1);
  const ticks = [top, Math.round(top / 2), 0];
  return (
    <div className="daychart">
      <div className="daychart-axis" aria-hidden="true">
        {ticks.map((tick, index) => (
          <span key={index}>{compactMoney(tick, lang)}</span>
        ))}
      </div>
      <div className="daychart-plot" role="img" aria-label={label}>
        {columns.map((column) => (
          <span key={column.key} className="daychart-col" data-tip={column.tip}>
            <i style={{ height: `${column.cents > 0 ? Math.max(3, (column.cents / top) * 100) : 0}%` }} />
          </span>
        ))}
      </div>
      <div className="daychart-days" aria-hidden="true">
        {columns.map((column) => (
          <span key={column.key}>{column.tick}</span>
        ))}
      </div>
    </div>
  );
}

export interface CrossRow {
  label: string;
  /** Amount per column key. */
  parts: Record<string, number>;
}

const CROSS_COLORS = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#7c3aed", "#14b8a6", "#94a3b8"];

/**
 * Two dimensions at once: one stacked bar per row, split by the column key.
 * The biggest keys get a colour each and the tail folds into one grey "others" key.
 */
export function CrossBars({
  rows,
  others,
  format,
  label,
}: {
  rows: CrossRow[];
  others: string;
  format: (cents: number) => string;
  label: string;
}) {
  const totals = new Map<string, number>();
  for (const row of rows) for (const [key, cents] of Object.entries(row.parts)) totals.set(key, (totals.get(key) ?? 0) + cents);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const keep = ranked.length > CROSS_COLORS.length ? ranked.slice(0, CROSS_COLORS.length - 1) : ranked;
  const keys = keep.length < ranked.length ? [...keep, others] : keep;
  const colorOf = (key: string) => CROSS_COLORS[keys.indexOf(key)] ?? CROSS_COLORS[CROSS_COLORS.length - 1];
  const folded = rows
    .map((row) => {
      const parts: Record<string, number> = {};
      for (const [key, cents] of Object.entries(row.parts)) {
        const target = keep.includes(key) ? key : others;
        parts[target] = (parts[target] ?? 0) + cents;
      }
      const total = Object.values(parts).reduce((sum, cents) => sum + cents, 0);
      return { label: row.label, parts, total };
    })
    .sort((a, b) => b.total - a.total);
  const reach = Math.max(...folded.map((row) => row.total), 1);
  return (
    <>
      <ul className="sheet-key">
        {keys.map((key) => (
          <li key={key}>
            <i style={{ background: colorOf(key) }} />
            {key}
          </li>
        ))}
      </ul>
      <ul className="barlist" aria-label={label}>
        {folded.map((row) => (
          <li key={row.label} className="barlist-row">
            <span className="barlist-label">{row.label}</span>
            <span className="barlist-track stacked">
              {keys
                .filter((key) => (row.parts[key] ?? 0) > 0)
                .map((key) => (
                  <i
                    key={key}
                    data-tip={`${row.label} · ${key}: ${format(row.parts[key])}`}
                    style={{ width: `${(row.parts[key] / reach) * 100}%`, background: colorOf(key) }}
                  />
                ))}
            </span>
            <span className="barlist-value">{format(row.total)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
