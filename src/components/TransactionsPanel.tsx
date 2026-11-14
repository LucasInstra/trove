import { useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Icon } from "./Icons";
import { Dialog } from "./Dialog";
import { dayLabel, formatCents, formatSignedCents, monthLabel } from "../lib/format";
import { api } from "../lib/api";
import { categoryName } from "../lib/i18n";
import { useLanguage } from "../lib/language";
import type { Account, Category, Tag, TransactionRow } from "../lib/api";

interface Props {
  rows: TransactionRow[];
  categories: Category[];
  tags: Tag[];
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
  onClearMonth: () => void;
  onEditEntry: (entry: TransactionRow) => void;
  onDeleteEntry: (id: number) => void;
  onRefund: (id: number) => void;
  onNewTransfer: () => void;
  onBulkCategory: (ids: number[], categoryId: number | null) => void;
  onBulkTag: (ids: number[], tagId: number, assign: boolean) => void;
  onNewTag: (name: string) => Promise<number | null>;
  onDeleteTag: (id: number) => void;
  month: string;
  groups: { day: string; rows: TransactionRow[]; total: number }[];
  accounts: Account[];
  accountFilter: number | null;
  onAccountFilter: (accountId: number | null) => void;
  tagFilter: number | null;
  onTagFilter: (tagId: number | null) => void;
}

function initial(row: TransactionRow): string {
  const source = row.categoryName || row.merchant || row.description || "?";
  return source.trim().charAt(0).toUpperCase();
}

export function TransactionsPanel({
  rows,
  categories,
  tags,
  search,
  loading,
  onSearch,
  onCategory,
  onImport,
  onClearMonth,
  onEditEntry,
  onDeleteEntry,
  onRefund,
  onNewTransfer,
  onBulkCategory,
  onBulkTag,
  onNewTag,
  onDeleteTag,
  month,
  groups,
  accounts,
  accountFilter,
  onAccountFilter,
  tagFilter,
  onTagFilter,
}: Props) {
  const { lang, t } = useLanguage();
  const searchRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmRefundId, setConfirmRefundId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [newTag, setNewTag] = useState("");
  const confirmDeleteRow = rows.find((row) => row.id === confirmDeleteId) ?? null;
  const visibleIds = new Set(rows.map((row) => row.id));
  const keptSelection = selected.filter((id) => visibleIds.has(id));
  const [kind, setKind] = useState<"all" | "in" | "out">("all");
  const real = rows.filter((row) => row.transferGroup == null);
  const incomeCents = real.filter((row) => row.amountCents > 0).reduce((sum, row) => sum + row.amountCents, 0);
  const expenseCents = real.filter((row) => row.amountCents < 0).reduce((sum, row) => sum - row.amountCents, 0);
  const shownGroups = groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter(
        (row) => kind === "all" || (kind === "in" ? row.amountCents > 0 : row.amountCents < 0),
      ),
    }))
    .filter((group) => group.rows.length > 0);
  const shownCount = shownGroups.reduce((sum, group) => sum + group.rows.length, 0);
  const [exported, setExported] = useState("");
  const [exportError, setExportError] = useState("");

  const onExport = async () => {
    setExported("");
    setExportError("");
    const dest = await save({
      defaultPath: `trove-${month}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!dest) return;
    try {
      const count = await api.exportCsv(dest, search, month, accountFilter, tagFilter);
      setExported(t("ledger.exported", { count }));
    } catch (problem) {
      setExportError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  return (
    <div className="ledger">
      <div className="ledger-head">
        <div className="ledger-title">
          <h2>{t("ledger.transactions")}</h2>
          <span className="muted count">{t("ledger.entries", { count: shownCount })}</span>
        </div>
        {rows.length > 0 ? (
          <button type="button" className="ghost" onClick={() => void onExport()}>
            {t("ledger.exportCsv")}
          </button>
        ) : null}
        {accounts.length > 1 ? (
          <button type="button" className="ghost" onClick={onNewTransfer}>
            <Icon name="arrow-left-right" size={14} />
            {t("transfer.new")}
          </button>
        ) : null}
        {rows.length > 0 ? (
          <button type="button" className="ghost danger" onClick={() => setConfirming(true)}>
            {t("ledger.clearMonth")}
          </button>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <dl className="ledger-summary">
          <div>
            <dt>{t("kpi.income")}</dt>
            <dd className="in">{formatCents(incomeCents)}</dd>
          </div>
          <div>
            <dt>{t("kpi.expense")}</dt>
            <dd className="out">{formatCents(expenseCents)}</dd>
          </div>
          <div>
            <dt>{t("chart.monthNet")}</dt>
            <dd className={incomeCents - expenseCents < 0 ? "out" : undefined}>
              {formatSignedCents(incomeCents - expenseCents)}
            </dd>
          </div>
        </dl>
      ) : null}

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
        <label className="account-filter">
          <span className="visually-hidden">{t("tags.filter")}</span>
          <select
            value={tagFilter ?? ""}
            onChange={(event) =>
              onTagFilter(event.target.value === "" ? null : Number(event.target.value))
            }
          >
            <option value="">{t("tags.all")}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                #{tag.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length > 0 ? (
        <div className="segmented kind-filter" role="group" aria-label={t("ledger.kindFilter")}>
          {(["all", "in", "out"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={kind === option ? "active" : undefined}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
            >
              {t(`ledger.kind_${option}`)}
            </button>
          ))}
        </div>
      ) : null}

      {keptSelection.length > 0 ? (
        <div className="card bulk-bar" role="toolbar" aria-label={t("bulk.title")}>
          <div className="bulk-head">
            <strong>{t("bulk.selected", { count: keptSelection.length })}</strong>
            <button type="button" className="ghost" onClick={() => setSelected([])}>
              {t("common.cancel")}
            </button>
          </div>
          <div className="bulk-row">
            <span className="muted small">{t("planner.category")}</span>
            <select
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
              aria-label={t("planner.category")}
            >
              <option value="">{t("bulk.pickCategory")}</option>
              <option value="none">{t("ledger.noCategory")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryName(t, category.name)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="outline-button small-button"
              disabled={bulkCategory === ""}
              onClick={() => {
                onBulkCategory(
                  keptSelection,
                  bulkCategory === "none" ? null : Number(bulkCategory),
                );
                setBulkCategory("");
                setSelected([]);
              }}
            >
              {t("bulk.applyCategory")}
            </button>
          </div>
          <div className="bulk-row">
            <span className="muted small">{t("tags.title")}</span>
            <select
              value={bulkTag}
              onChange={(event) => setBulkTag(event.target.value)}
              aria-label={t("tags.title")}
            >
              <option value="">{t("bulk.pickTag")}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="outline-button small-button"
              disabled={bulkTag === ""}
              onClick={() => {
                onBulkTag(keptSelection, Number(bulkTag), true);
                setSelected([]);
              }}
            >
              {t("bulk.attach")}
            </button>
            <button
              type="button"
              className="outline-button small-button"
              disabled={bulkTag === ""}
              onClick={() => {
                onBulkTag(keptSelection, Number(bulkTag), false);
                setSelected([]);
              }}
            >
              {t("bulk.detach")}
            </button>
            {bulkTag !== "" ? (
              <button
                type="button"
                className="icon-button danger"
                title={t("common.delete")}
                aria-label={`${t("common.delete")}: #${tags.find((tag) => tag.id === Number(bulkTag))?.name ?? ""}`}
                onClick={() => {
                  onDeleteTag(Number(bulkTag));
                  setBulkTag("");
                  setSelected([]);
                }}
              >
                <Icon name="trash" size={15} />
              </button>
            ) : null}
          </div>
          <div className="bulk-row">
            <input
              value={newTag}
              onChange={(event) => setNewTag(event.target.value)}
              maxLength={40}
              placeholder={t("tags.new")}
              aria-label={t("tags.new")}
            />
            <button
              type="button"
              className="outline-button small-button"
              disabled={newTag.trim() === ""}
              onClick={() =>
                void onNewTag(newTag.trim()).then((id) => {
                  if (id !== null) {
                    onBulkTag(keptSelection, id, true);
                    setBulkTag(String(id));
                  }
                  setNewTag("");
                  setSelected([]);
                })
              }
            >
              {newTag.trim() === ""
                ? t("bulk.createAttach")
                : t("bulk.createAttachNamed", { name: newTag.trim() })}
            </button>
          </div>
        </div>
      ) : null}

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
        <div className="card tx-table">
          <div className="tx-colhead" aria-hidden="true">
            <span />
            <span />
            <span>{t("ledger.colDescription")}</span>
            <span>{t("planner.category")}</span>
            <span className="num">{t("planner.amount")}</span>
            <span />
          </div>
          {shownGroups.length === 0 ? <p className="card-empty">{t("ledger.nothingHere")}</p> : null}
          {shownGroups.map((group) => (
            <section className="tx-day" key={group.day}>
              <header className="tx-day-head">
                <span>{dayLabel(group.day, lang)}</span>
                <span>{formatSignedCents(group.total)}</span>
              </header>
              <div className="tx-group">
                {group.rows.map((row) => {
                  const color = row.categoryColor ?? "#8b8798";
                  const checked = selected.includes(row.id);
                  return (
                    <div className={checked ? "tx-row selected" : "tx-row"} key={row.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelected((current) =>
                            checked
                              ? current.filter((id) => id !== row.id)
                              : [...current, row.id],
                          )
                        }
                        aria-label={t("bulk.select", { desc: row.description })}
                        className="tx-select"
                      />
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
                          {row.manual && !row.transferGroup ? <em className="pill-soft">{t("ledger.manual")}</em> : null}
                          {row.transferGroup ? <em className="pill-soft">{t("transfer.badge")}</em> : null}
                          {row.refundOf != null ? <em className="pill-soft">{t("refund.badge")}</em> : null}
                          {row.hasRefund ? <em className="pill-soft">{t("refund.refunded")}</em> : null}
                        </span>
                        <span className="tx-sub">
                          {(row.categoryName ? categoryName(t, row.categoryName) : null) ?? t("ledger.noCategory")} · {row.accountName}
                        </span>
                        {row.tags.length > 0 ? (
                          <span className="tx-tags">
                            {row.tags.map((tag) => (
                              <em key={tag.id} className="pill-soft">
                                #{tag.name}
                              </em>
                            ))}
                          </span>
                        ) : null}
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
                        aria-label={t("ledger.category")}
                      >
                        <option value="">{t("ledger.noCategory")}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {categoryName(t, category.name)}
                          </option>
                        ))}
                      </select>
                      <span className={row.amountCents < 0 ? "tx-amount out" : "tx-amount in"}>
                        {formatSignedCents(row.amountCents)}
                      </span>
                      <span className="tx-actions">
                        {row.transferGroup == null && row.refundOf == null && !row.hasRefund ? (
                          <button
                            type="button"
                            className="icon-button"
                            title={t("refund.action")}
                            aria-label={`${t("refund.action")}: ${row.description}`}
                            onClick={() => setConfirmRefundId(row.id)}
                          >
                            <Icon name="swap" size={15} />
                          </button>
                        ) : null}
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

      {exported ? <p className="muted small ledger-foot">{exported}</p> : null}
      {exportError ? (
        <div className="alert" role="alert">
          {exportError}
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
        <Dialog
          title={confirmDeleteRow?.transferGroup ? t("transfer.deleteTitle") : t("ledger.deleteTitle")}
          onClose={() => setConfirmDeleteId(null)}
        >
          <p className="muted">
            {confirmDeleteRow?.transferGroup ? t("transfer.deleteDesc") : t("ledger.deleteDesc")}
          </p>
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

      {confirmRefundId !== null ? (
        <Dialog title={t("refund.title")} onClose={() => setConfirmRefundId(null)}>
          <p className="muted">{t("refund.desc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmRefundId(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onRefund(confirmRefundId);
                setConfirmRefundId(null);
              }}
            >
              {t("refund.confirm")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
