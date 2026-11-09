import { Donut } from "../components/Donut";
import { Mascot } from "../components/Mascot";
import { Icon } from "../components/Icons";
import type { Category, CategoryTotal, MonthPoint, MonthTotals, TransactionRow } from "../lib/api";
import type { KeeperLook } from "../lib/keeper";
import {
  formatCents,
  formatDate,
  formatSignedCents,
  monthLabel,
  monthShort,
} from "../lib/format";

interface LedgerScreenProps {
  look: KeeperLook;
  rows: TransactionRow[];
  categories: Category[];
  totals: MonthTotals | null;
  byCategory: CategoryTotal[];
  series: MonthPoint[];
  month: string;
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onMonth: (delta: number) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
}

export function LedgerScreen({
  look,
  rows,
  categories,
  totals,
  byCategory,
  series,
  month,
  search,
  loading,
  onSearch,
  onMonth,
  onCategory,
  onImport,
}: LedgerScreenProps) {
  const income = totals?.incomeCents ?? 0;
  const expense = totals?.expenseCents ?? 0;
  const net = income - expense;
  const spending = byCategory.reduce((sum, item) => sum + item.totalCents, 0);
  const peak = Math.max(...series.map((point) => point.expenseCents), 1);

  return (
    <section className="screen">
      <header className="screen-head">
        <div>
          <h1>Ledger</h1>
          <p className="sub">Everything you imported, one month at a time.</p>
        </div>
        <div className="head-actions">
          <div className="month-nav">
            <button type="button" className="icon-button" onClick={() => onMonth(-1)} aria-label="Previous month">
              <Icon name="left" size={15} />
            </button>
            <span className="month-label">{monthLabel(month)}</span>
            <button type="button" className="icon-button" onClick={() => onMonth(1)} aria-label="Next month">
              <Icon name="right" size={15} />
            </button>
          </div>
          <button type="button" className="primary" onClick={onImport}>
            <Icon name="plus" size={15} />
            Import statement
          </button>
        </div>
      </header>

      <div className="stats">
        <article className="stat">
          <span>In</span>
          <strong className="positive">{formatCents(income)}</strong>
        </article>
        <article className="stat">
          <span>Out</span>
          <strong className="negative">{formatCents(expense)}</strong>
        </article>
        <article className="stat">
          <span>Net</span>
          <strong className={net < 0 ? "negative" : "positive"}>{formatSignedCents(net)}</strong>
        </article>
        <article className="stat">
          <span>Entries</span>
          <strong>{totals?.transactionCount ?? 0}</strong>
        </article>
      </div>

      <div className="charts">
        <article className="card">
          <header className="card-head">
            <h2>Where the money went</h2>
            <span className="muted">{monthLabel(month)}</span>
          </header>

          {byCategory.length === 0 ? (
            <p className="card-empty">No spending in this month.</p>
          ) : (
            <div className="donut-row">
              <Donut segments={byCategory.map((item) => ({ color: item.color, value: item.totalCents }))} />
              <ul className="legend">
                {byCategory.map((item) => (
                  <li key={`${item.categoryId ?? "none"}-${item.name}`}>
                    <span className="dot" style={{ background: item.color }} />
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-value">{formatCents(item.totalCents)}</span>
                    <span className="legend-share">
                      {spending > 0 ? Math.round((item.totalCents / spending) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="card">
          <header className="card-head">
            <h2>Last six months</h2>
            <span className="muted">spending</span>
          </header>
          <div className="bars">
            {series.map((point) => (
              <div className="bar-col" key={point.month}>
                <span className="bar-value">
                  {point.expenseCents > 0 ? formatCents(point.expenseCents) : ""}
                </span>
                <div className="bar-track">
                  <div
                    className={
                      point.expenseCents === 0
                        ? "bar blank"
                        : point.month === month
                          ? "bar current"
                          : "bar"
                    }
                    style={{
                      height:
                        point.expenseCents === 0
                          ? "0%"
                          : `${Math.max(3, (point.expenseCents / peak) * 100)}%`,
                    }}
                    title={`${monthLabel(point.month)}: ${formatCents(point.expenseCents)}`}
                  />
                </div>
                <span className={point.month === month ? "bar-label current" : "bar-label"}>
                  {monthShort(point.month)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={15} />
          <input
            type="search"
            placeholder="Search description, merchant or category"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <span className="muted count">{rows.length} entries</span>
      </div>

      {loading ? <p className="muted">Loading...</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="empty">
          <div className="mascot-stage">
            <Mascot look={look} mood="sleepy" size={86} />
          </div>
          <h2>Nothing here yet</h2>
          <p className="muted">
            Import the OFX file your bank already offers. Nothing leaves this computer.
          </p>
          <button type="button" className="primary" onClick={onImport}>
            Choose a file
          </button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th>Account</th>
                <th>Category</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap muted small">{formatDate(row.postedOn)}</td>
                  <td>
                    <strong>{row.merchant || row.description}</strong>
                    {row.merchant && row.merchant !== row.description ? (
                      <span className="sub-line">{row.description}</span>
                    ) : null}
                  </td>
                  <td className="muted nowrap small">{row.accountName}</td>
                  <td>
                    <select
                      className="category"
                      value={row.categoryId ?? ""}
                      onChange={(event) =>
                        onCategory(
                          row.id,
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      style={
                        row.categoryColor
                          ? {
                              background: `${row.categoryColor}14`,
                              borderColor: `${row.categoryColor}59`,
                            }
                          : undefined
                      }
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={row.amountCents < 0 ? "right amount out" : "right amount in"}>
                    {formatSignedCents(row.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
