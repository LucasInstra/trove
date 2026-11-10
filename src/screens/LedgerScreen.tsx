import { useMemo, useRef } from "react";
import { Donut } from "../components/Donut";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";
import type {
  Account,
  Category,
  CategoryTotal,
  MonthPoint,
  MonthTotals,
  TransactionRow,
} from "../lib/api";
import { dayLabel, formatCents, formatSignedCents, monthLabel, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";
import type { KeeperLook } from "../lib/keeper";

interface LedgerScreenProps {
  look: KeeperLook;
  rows: TransactionRow[];
  accounts: Account[];
  categories: Category[];
  totals: MonthTotals | null;
  byCategory: CategoryTotal[];
  series: MonthPoint[];
  month: string;
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onMonth: (delta: number) => void;
  onSelectMonth: (month: string) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
  onSettings: () => void;
}

function maskedAccount(account: Account | undefined, empty: string): string {
  if (!account) return empty;
  const digits = account.acctId.replace(/\D/g, "");
  const tail = digits.length >= 4 ? digits.slice(-4) : account.acctId;
  return `•••• ${tail}`;
}

function initial(row: TransactionRow): string {
  const source = row.categoryName || row.merchant || row.description || "?";
  return source.trim().charAt(0).toUpperCase();
}

export function LedgerScreen({
  look,
  rows,
  accounts,
  categories,
  totals,
  byCategory,
  series,
  month,
  search,
  loading,
  onSearch,
  onMonth,
  onSelectMonth,
  onCategory,
  onImport,
  onSettings,
}: LedgerScreenProps) {
  const { lang, t } = useLanguage();
  const searchRef = useRef<HTMLInputElement>(null);
  const income = totals?.incomeCents ?? 0;
  const expense = totals?.expenseCents ?? 0;
  const net = income - expense;
  const spending = byCategory.reduce((sum, item) => sum + item.totalCents, 0);
  const peak = Math.max(...series.map((point) => point.expenseCents), 1);
  const kept = Math.max(0, net);
  // Share of what came in that stayed, which is the question this screen asks.
  const keptShare = income > 0 ? Math.round((net / income) * 100) : 0;
  const spentOfPot = expense + kept > 0 ? Math.round((expense / (expense + kept)) * 100) : 0;
  const account = accounts[0];
  const entries = totals?.transactionCount ?? 0;


  const groups = useMemo(() => {
    const map = new Map<string, { rows: TransactionRow[]; total: number }>();
    for (const row of rows) {
      const entry = map.get(row.postedOn) ?? { rows: [], total: 0 };
      entry.rows.push(row);
      entry.total += row.amountCents;
      map.set(row.postedOn, entry);
    }
    return [...map.entries()].map(([day, value]) => ({ day, ...value }));
  }, [rows]);

  return (
    <section className="screen">
      <header className="topbar">
        <div>
          <div className="title-row">
            <button
              type="button"
              className="icon-button"
              onClick={() => onMonth(-1)}
              aria-label="Previous month"
            >
              <Icon name="left" size={16} />
            </button>
            <h1>{monthLabel(month, lang)}</h1>
            <button
              type="button"
              className="icon-button"
              onClick={() => onMonth(1)}
              aria-label="Next month"
            >
              <Icon name="right" size={16} />
            </button>
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="primary" onClick={onImport}>
            <Icon name="plus" size={15} />
            {t("ledger.import")}
          </button>
        </div>
      </header>

      <div className="hero">
        <article className="account-card">
          <div className="account-top">
            <span className="account-label">{t("ledger.leftThisMonth")}</span>
            <span className="account-chip">{t("ledger.local")}</span>
          </div>
          <div className="account-value-row">
            <strong className="account-value">{formatSignedCents(net)}</strong>
            {income > 0 ? (
              <span className={net >= 0 ? "account-badge" : "account-badge down"}>
                <Icon name="trend" size={13} />
                {net >= 0
                  ? t("ledger.keptShare", { percent: Math.abs(keptShare) })
                  : t("ledger.overShare", { percent: Math.abs(keptShare) })}
              </span>
            ) : null}
          </div>
          <div className="account-bottom">
            <div>
              <span className="account-meta-label">{account?.name ?? t("ledger.noAccount")}</span>
              <span className="account-meta">
                {account ? maskedAccount(account, t("ledger.importToStart")) : t("ledger.importToStart")}
              </span>
            </div>
            <div className="account-inout">
              <span>{t("ledger.in", { amount: formatCents(income) })}</span>
              <span>{t("ledger.out", { amount: formatCents(expense) })}</span>
            </div>
          </div>
        </article>

        <article className="card summary">
          <header className="card-head">
            <h2>{t("ledger.thisMonth")}</h2>
            <span className="muted">{t("ledger.entries", { count: entries })}</span>
          </header>
          {expense + kept > 0 ? (
            <>
              <div className="summary-split">
                <span className="split-out" style={{ width: `${Math.max(2, spentOfPot)}%` }} />
                <span
                  className="split-kept"
                  style={{ width: `${Math.max(2, 100 - spentOfPot)}%` }}
                />
              </div>
              <ul className="split-legend">
                <li>
                  <span className="dot split-out-dot" />
                  <span>{t("ledger.moneyOut")}</span>
                  <strong>{formatCents(expense)}</strong>
                  <span className="muted">{spentOfPot}%</span>
                </li>
                <li>
                  <span className="dot split-kept-dot" />
                  <span>{t("ledger.kept")}</span>
                  <strong>{formatCents(kept)}</strong>
                  <span className="muted">{100 - spentOfPot}%</span>
                </li>
              </ul>
              <p className="muted small">
                {income > 0
                  ? t("ledger.splitOf", { amount: formatCents(income) })
                  : t("ledger.noIncome")}
              </p>
            </>
          ) : (
            <p className="card-empty">{t("ledger.noIncome")}</p>
          )}
        </article>
      </div>

      <div className="quick-actions">
        <button type="button" className="quick-action" onClick={onImport}>
          <span className="quick-icon">
            <Icon name="plus" size={17} />
          </span>
          <span className="quick-copy">
            <strong>{t("ledger.quickImportTitle")}</strong>
            <span>{t("ledger.quickImportDesc")}</span>
          </span>
        </button>
        <button type="button" className="quick-action" onClick={() => searchRef.current?.focus()}>
          <span className="quick-icon">
            <Icon name="search" size={17} />
          </span>
          <span className="quick-copy">
            <strong>{t("ledger.quickSearchTitle")}</strong>
            <span>{t("ledger.quickSearchDesc")}</span>
          </span>
        </button>
        <button type="button" className="quick-action" onClick={onSettings}>
          <span className="quick-icon">
            <Icon name="settings" size={17} />
          </span>
          <span className="quick-copy">
            <strong>{t("ledger.quickSettingsTitle")}</strong>
            <span>{t("ledger.quickSettingsDesc")}</span>
          </span>
        </button>
      </div>

      <div className="charts">
        <article className="card">
          <header className="card-head">
            <h2>{t("ledger.whereMoney")}</h2>
            <span className="muted">{monthLabel(month, lang)}</span>
          </header>

          {byCategory.length === 0 ? (
            <p className="card-empty">{t("ledger.noSpending")}</p>
          ) : (
            <div className="donut-row">
              <Donut
                segments={byCategory.map((item) => ({ color: item.color, value: item.totalCents }))}
              />
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
            <h2>{t("ledger.lastSix")}</h2>
            <span className="muted">{t("ledger.spending")}</span>
          </header>
          <div className="bars">
            {series.map((point) => (
              <button
                type="button"
                className="bar-col"
                key={point.month}
                onClick={() => onSelectMonth(point.month)}
                aria-current={point.month === month}
                aria-label={`${monthLabel(point.month, lang)}: ${formatCents(point.expenseCents)}`}
              >
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
                    title={`${monthLabel(point.month, lang)}: ${formatCents(point.expenseCents)}`}
                  />
                </div>
                <span className={point.month === month ? "bar-label current" : "bar-label"}>
                  {monthShort(point.month, lang)}
                </span>
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="ledger">
        <div className="ledger-head">
          <h2>{t("ledger.transactions")}</h2>
          <span className="muted count">{t("ledger.entries", { count: rows.length })}</span>
        </div>

        <div className="toolbar">
          <label className="search">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              type="search"
              placeholder={t("ledger.searchPlaceholder")}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        </div>

        {loading ? <p className="muted">{t("common.loading")}</p> : null}

        {!loading && rows.length === 0 ? (
          <div className="empty">
            <div className="mascot-stage">
              <Mascot look={look} mood="sleepy" size={86} hint={t("keeper.hint")} />
            </div>
            <h2>{t("ledger.emptyTitle")}</h2>
            <p className="muted">{t("ledger.emptyDesc")}</p>
            <button type="button" className="primary" onClick={onImport}>
              {t("ledger.chooseFile")}
            </button>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="tx-list">
            {groups.map((group) => (
              <section className="tx-day" key={group.day}>
                <header className="tx-day-head">
                  <span>{dayLabel(group.day, lang)}</span>
                  <span>{formatSignedCents(group.total)}</span>
                </header>
                <div className="tx-group">
                  {group.rows.map((row) => {
                    const color = row.categoryColor ?? "#8b8798";
                    return (
                      <div className="tx-row" key={row.id}>
                        <span
                          className="tx-icon"
                          style={{ background: `${color}1f`, color }}
                          aria-hidden="true"
                        >
                          {initial(row)}
                        </span>
                        <div className="tx-main">
                          <span className="tx-title">{row.merchant || row.description}</span>
                          <span className="tx-sub">
                            {row.categoryName ?? t("ledger.noCategory")} · {row.accountName}
                          </span>
                        </div>
                        <select
                          className="tx-category"
                          value={row.categoryId ?? ""}
                          onChange={(event) =>
                            onCategory(
                              row.id,
                              event.target.value === "" ? null : Number(event.target.value),
                            )
                          }
                          aria-label="Category"
                        >
                          <option value="">{t("ledger.noCategory")}</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <span className={row.amountCents < 0 ? "tx-amount out" : "tx-amount in"}>
                          {formatSignedCents(row.amountCents)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
