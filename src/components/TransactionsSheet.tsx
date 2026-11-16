import { BarList, type BarListRow } from "./charts/BarList";
import { ColumnChart, CrossBars, GroupedDistribution, StatTiles, compactMoney, type Column, type CrossRow, type Grouping } from "./charts/ChartParts";
import { SortHeader } from "./SortHeader";
import { nextSort, sortRows, type SortState } from "../domain/sort";
import { Icon } from "./Icons";
import { useState } from "react";
import { formatCents } from "../lib/format";
import { categoryName } from "../lib/i18n";
import { useLanguage } from "../lib/language";
import type { Category, TransactionRow } from "../lib/api";

const FALLBACK = "#94a3b8";

function shortDate(iso: string, lang: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return lang === "pt" ? `${d}/${m}/${y}` : `${y}-${m}-${d}`;
}

/**
 * The month's entries as a spreadsheet: one row each, category editable in
 * place, totals at the foot and two charts below. Everything else goes through
 * the same edit dialog as the list, so no new write path exists.
 */
export function TransactionsSheet({
  rows,
  categories,
  onCategory,
  onEditEntry,
  onDeleteEntry,
}: {
  rows: TransactionRow[];
  categories: Category[];
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onEditEntry: (entry: TransactionRow) => void;
  onDeleteEntry: (id: number) => void;
}) {
  const { lang, t } = useLanguage();
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });
  const real = rows.filter((row) => row.transferGroup == null);
  const income = real.filter((row) => row.amountCents > 0).reduce((sum, row) => sum + row.amountCents, 0);
  const expense = real.filter((row) => row.amountCents < 0).reduce((sum, row) => sum - row.amountCents, 0);

  const active = categories.filter((category) => category.archivedAt == null);

  return (
    <>
      <article className="card sheet-card">
        <div className="sheet-wrap">
          <table className="sheet-table tx-sheet">
            <thead>
              <tr>
                <SortHeader id="date" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k))} className="typed" label={t("transactions.sheet.date")} />
                <SortHeader id="description" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k))} className="typed" label={t("transactions.sheet.description")} />
                <SortHeader id="category" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k))} className="typed" label={t("transactions.sheet.category")} />
                <SortHeader id="account" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k))} className="typed" label={t("transactions.sheet.account")} />
                <SortHeader id="tags" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k))} className="typed" label={t("transactions.sheet.tags")} />
                <SortHeader id="amount" sort={sort} onSort={(k) => setSort((c) => nextSort(c, k))} className="typed" label={t("transactions.sheet.amount")} />
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {sortRows(rows, sort, (row, key) => {
                switch (key) {
                  case "date": return row.postedOn;
                  case "description": return row.merchant || row.description;
                  case "category": return row.transferGroup ? "" : (row.categoryName ?? "");
                  case "account": return row.accountName;
                  case "tags": return row.tags.map((tag) => tag.name).join(" ");
                  default: return row.amountCents;
                }
              }).map((row) => {
                const title = row.merchant || row.description;
                return (
                  <tr key={row.id}>
                    <td>{shortDate(row.postedOn, lang)}</td>
                    <td className="tx-sheet-desc" title={row.description}>
                      {title}
                    </td>
                    <td>
                      {row.transferGroup ? (
                        <span className="muted">{t("transactions.sheet.transfer")}</span>
                      ) : (
                        <select
                          className="sheet-input"
                          aria-label={`${t("transactions.sheet.category")}: ${title}`}
                          value={row.categoryId ?? ""}
                          onChange={(event) =>
                            onCategory(row.id, event.target.value === "" ? null : Number(event.target.value))
                          }
                        >
                          <option value="">{t("transactions.sheet.uncategorized")}</option>
                          {active.map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryName(t, category.name)}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>{row.accountName}</td>
                    <td>{row.tags.map((tag) => `#${tag.name}`).join(" ")}</td>
                    <td className="num" style={{ color: row.amountCents > 0 ? "var(--positive)" : undefined }}>
                      {formatCents(row.amountCents)}
                    </td>
                    <td className="tx-sheet-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={t("common.edit")}
                        aria-label={`${t("common.edit")}: ${title}`}
                        onClick={() => onEditEntry(row)}
                      >
                        <Icon name="pencil" size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title={t("common.delete")}
                        aria-label={`${t("common.delete")}: ${title}`}
                        onClick={() => onDeleteEntry(row.id)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    {t("transactions.sheet.income")} {formatCents(income)} · {t("transactions.sheet.expense")}{" "}
                    {formatCents(expense)}
                  </td>
                  <td className="num" title={t("transactions.sheet.balance")}>
                    {formatCents(income - expense)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
          {rows.length === 0 ? <p className="muted sheet-empty">{t("transactions.sheet.empty")}</p> : null}
        </div>
      </article>

    </>
  );
}

const SERIES = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#7c3aed", "#14b8a6", "#ef4444"];

/** Biggest groups first, the tail folded into one "Others" row so the list stays readable. */
function fold(groups: { label: string; cents: number; color?: string }[], others: string, keep = 8): BarListRow[] {
  const sorted = [...groups].sort((a, b) => b.cents - a.cents);
  const head = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((sum, group) => sum + group.cents, 0);
  const all = rest > 0 ? [...head, { label: others, cents: rest, color: FALLBACK }] : head;
  return all.map((group, index) => ({
    label: group.label,
    value: group.cents,
    display: formatCents(group.cents),
    color: group.color ?? SERIES[index % SERIES.length],
  }));
}

/** Spending charts for the rows shown: headline numbers, regrouped, day by day and the biggest items. */
export function TransactionsCharts({ rows }: { rows: TransactionRow[] }) {
  const { lang, t } = useLanguage();
  const spent = rows.filter((row) => row.transferGroup == null && row.amountCents < 0);
  if (spent.length === 0) return <p className="muted sheet-empty">{t("transactions.sheet.empty")}</p>;
  const expense = spent.reduce((sum, row) => sum - row.amountCents, 0);

  const sum = (key: (row: TransactionRow) => string, label: (raw: string) => string, color?: (row: TransactionRow) => string | null) => {
    const map = new Map<string, { label: string; cents: number; color?: string }>();
    for (const row of spent) {
      const raw = key(row);
      const entry = map.get(raw) ?? { label: label(raw), cents: 0, color: color?.(row) ?? undefined };
      entry.cents -= row.amountCents;
      map.set(raw, entry);
    }
    return [...map.values()];
  };
  const uncategorized = t("transactions.sheet.uncategorized");
  const byCategory = sum(
    (row) => row.categoryName ?? "",
    (raw) => (raw ? categoryName(t, raw) : uncategorized),
    (row) => row.categoryColor ?? FALLBACK,
  );
  const others = t("transactions.sheet.others");
  const groupings: Grouping[] = [
    { id: "category", label: t("transactions.sheet.groupCategory"), rows: fold(byCategory, others) },
    { id: "account", label: t("transactions.sheet.groupAccount"), rows: fold(sum((row) => row.accountName, (raw) => raw), others) },
    {
      id: "merchant",
      label: t("transactions.sheet.groupMerchant"),
      rows: fold(sum((row) => (row.merchant || row.description).trim(), (raw) => raw || uncategorized), others),
    },
  ];

  const crossMap = new Map<string, Record<string, number>>();
  for (const row of spent) {
    const category = row.categoryName ? categoryName(t, row.categoryName) : uncategorized;
    const parts = crossMap.get(category) ?? {};
    parts[row.accountName] = (parts[row.accountName] ?? 0) - row.amountCents;
    crossMap.set(category, parts);
  }
  const cross: CrossRow[] = [...crossMap.entries()].map(([label, parts]) => ({ label, parts }));

  // Every calendar day of the month, so the bars keep their place and quiet days show as gaps.
  const byDay = new Map<string, number>();
  for (const row of spent) byDay.set(row.postedOn, (byDay.get(row.postedOn) ?? 0) - row.amountCents);
  const month = [...byDay.keys()].sort()[0].slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const perDay: Column[] = Array.from({ length: lastDay }, (_, index) => {
    const day = `${month}-${String(index + 1).padStart(2, "0")}`;
    const cents = byDay.get(day) ?? 0;
    const n = index + 1;
    return { key: day, cents, tick: n === 1 || n % 5 === 0 || n === lastDay ? String(n) : "", tip: `${n}: ${formatCents(cents)}` };
  });

  const topCategory = [...byCategory].sort((a, b) => b.cents - a.cents)[0];
  const largest: BarListRow[] = [...spent]
    .sort((a, b) => a.amountCents - b.amountCents)
    .slice(0, 5)
    .map((row, index) => ({
      label: `${row.postedOn.slice(8, 10)}/${row.postedOn.slice(5, 7)} · ${(row.merchant || row.description).trim()}`,
      value: -row.amountCents,
      display: formatCents(-row.amountCents),
      color: SERIES[index % SERIES.length],
    }));

  return (
    <>
      <StatTiles
        items={[
          { label: t("transactions.sheet.totalSpent"), value: formatCents(expense) },
          { label: t("transactions.sheet.avgDay"), value: formatCents(Math.round(expense / lastDay)) },
          { label: t("transactions.sheet.topCategory"), value: topCategory.label, note: formatCents(topCategory.cents) },
          { label: t("transactions.sheet.count"), value: String(spent.length) },
        ]}
      />

      <div className="sheet-charts-grid">
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("transactions.sheet.byAccount")}</h2>
            </div>
          </header>
          <BarList rows={groupings[1].rows} label={t("transactions.sheet.byAccount")} />
        </article>
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("transactions.sheet.crossCategoryAccount")}</h2>
            </div>
          </header>
          <CrossBars rows={cross} others={others} format={formatCents} label={t("transactions.sheet.crossCategoryAccount")} />
        </article>
      </div>

      <div className="sheet-charts-grid">
      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <h2>{t("transactions.sheet.byDay")}</h2>
          </div>
        </header>
        <ColumnChart columns={perDay} label={t("transactions.sheet.byDay")} lang={lang} />
      </article>

      <article className="card">
        <header className="card-head">
          <div className="card-title">
            <h2>{t("transactions.sheet.largest")}</h2>
          </div>
        </header>
        <BarList rows={largest} label={t("transactions.sheet.largest")} />
      </article>
      </div>

      <GroupedDistribution
        title={t("transactions.sheet.distribution")}
        groupings={groupings}
        centerLabel={t("transactions.sheet.expense")}
        centerValue={compactMoney(expense, lang)}
      />
    </>
  );
}
