import { useRef, useState } from "react";
import { Icon } from "./Icons";
import { Dialog } from "./Dialog";
import { dayLabel, formatCents, formatSignedCents, monthLabel } from "../lib/format";
import { useLanguage } from "../lib/language";
import type { Account, Category, TransactionRow } from "../lib/api";

interface Props {
  rows: TransactionRow[];
  categories: Category[];
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
  onClearMonth: () => void;
  onEditEntry: (entry: TransactionRow) => void;
  onDeleteEntry: (id: number) => void;
  month: string;
  groups: { day: string; rows: TransactionRow[]; total: number }[];
  accounts: Account[];
  accountFilter: number | null;
  onAccountFilter: (accountId: number | null) => void;
}

function initial(row: TransactionRow): string {
  const source = row.categoryName || row.merchant || row.description || "?";
  return source.trim().charAt(0).toUpperCase();
}

export function TransactionsPanel({
  rows,
  categories,
  search,
  loading,
  onSearch,
  onCategory,
  onImport,
  onClearMonth,
  onEditEntry,
  onDeleteEntry,
  month,
  groups,
  accounts,
  accountFilter,
  onAccountFilter,
}: Props) {
  const { lang, t } = useLanguage();
  const searchRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <div className="ledger">
      <div className="ledger-head">
        <h2>{t("ledger.transactions")}</h2>
        <span className="muted count">{t("ledger.entries", { count: rows.length })}</span>
        {rows.length > 0 ? (
          <button type="button" className="ghost danger" onClick={() => setConfirming(true)}>
            {t("ledger.clearMonth")}
          </button>
        ) : null}
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
        <label className="account-filter">
          <span className="visually-hidden">{t("ledger.account")}</span>
          <select
            value={accountFilter ?? ""}
            onChange={(event) =>
              onAccountFilter(event.target.value === "" ? null : Number(event.target.value))
            }
          >
            <option value="">{t("ledger.allAccounts")}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="muted">{t("common.loading")}</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="empty">
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
                        <span className="tx-title">
                          {row.merchant || row.description}
                          {row.manual ? <em className="pill-soft">{t("ledger.manual")}</em> : null}
                        </span>
                        <span className="tx-sub">
                          {row.categoryName ?? t("ledger.noCategory")} · {row.accountName}
                        </span>
                        {row.notes ? <span className="tx-note">{row.notes}</span> : null}
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
                      <span className="tx-actions">
                        {row.manual ? (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              title={t("common.edit")}
                              aria-label={`${t("common.edit")}: ${row.description}`}
                              onClick={() => onEditEntry(row)}
                            >
                              <Icon name="pencil" size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              title={t("common.delete")}
                              aria-label={`${t("common.delete")}: ${row.description}`}
                              onClick={() => setConfirmDeleteId(row.id)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <p className="muted small ledger-foot">
          {t("ledger.total", { amount: formatCents(groups.reduce((total, group) => total + group.total, 0)) })}
        </p>
      ) : null}

      {confirming ? (
        <Dialog
          title={t("ledger.clearTitle", { month: monthLabel(month, lang) })}
          onClose={() => setConfirming(false)}
        >
          <p className="muted">{t("ledger.clearDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setConfirming(false);
                onClearMonth();
              }}
            >
              {t("ledger.clearConfirm")}
            </button>
          </div>
        </Dialog>
      ) : null}

      {confirmDeleteId !== null ? (
        <Dialog title={t("ledger.deleteTitle")} onClose={() => setConfirmDeleteId(null)}>
          <p className="muted">{t("ledger.deleteDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmDeleteId(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onDeleteEntry(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
