import { useState, type CSSProperties } from "react";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icons";
import { HoldingDialog, ScreenHeader } from "./PlannerScreens";
import { investmentLines, investmentSummary } from "../domain/patrimony";
import type { Holding, HoldingInput } from "../lib/api";
import { formatCents, formatDate } from "../lib/format";
import { useLanguage } from "../lib/language";

const SERIES = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#7c3aed", "#14b8a6", "#ef4444"];

function percent(value: number, lang: string): string {
  const text = new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
  return `${text}%`;
}

function signed(cents: number): string {
  return `${cents > 0 ? "+" : ""}${formatCents(cents)}`;
}

/**
 * The investments among the holdings: what they are worth, how the portfolio
 * is split, and, where the amount put in was informed, what each one returned.
 * Values are typed by hand, so nothing here moves on its own.
 */
export function InvestmentsScreen({
  holdings,
  onSaveHolding,
  onDeleteHolding,
}: {
  holdings: Holding[];
  onSaveHolding: (input: HoldingInput) => void;
  onDeleteHolding: (id: number) => void;
}) {
  const { lang, t } = useLanguage();
  const [dialog, setDialog] = useState<{ holding: Holding | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Holding | null>(null);

  const lines = investmentLines(holdings);
  const summary = investmentSummary(lines);
  const colorOf = (index: number) => SERIES[index % SERIES.length];
  const holdingOf = (id: number) => holdings.find((holding) => holding.id === id) ?? null;
  const up = summary.gainCents >= 0;

  return (
    <section className="screen planner-screen">
      <ScreenHeader
        eyebrow={t("nav.patrimony")}
        title={t("investments.title")}
        description={t("investments.description")}
        action={{ label: t("investments.new"), onClick: () => setDialog({ holding: null }) }}
      />

      <div className="planner-metrics">
        <article className="card metric-card metric-card-primary">
          <span className="metric-label">{t("investments.value")}</span>
          <strong className="metric-value">{formatCents(summary.valueCents)}</strong>
          <span className="metric-note">{t("investments.count", { count: lines.length })}</span>
        </article>
        <article className="card metric-card">
          <span className="metric-label">{t("investments.invested")}</span>
          <strong className="metric-value">
            {summary.trackedCostCents > 0 ? formatCents(summary.trackedCostCents) : "—"}
          </strong>
          <span className="metric-note">
            {summary.untracked > 0
              ? t("investments.untracked", { count: summary.untracked })
              : t("investments.allTracked")}
          </span>
        </article>
        <article className="card metric-card metric-card-secondary">
          <span className="metric-label">{t("investments.return")}</span>
          <strong
            className="metric-value"
            style={summary.gainPct === null ? undefined : { color: up ? "var(--positive)" : "var(--negative)" }}
          >
            {summary.gainPct === null ? "—" : signed(summary.gainCents)}
          </strong>
          <span className="metric-note">
            {summary.gainPct === null ? t("investments.noReturn") : percent(summary.gainPct, lang)}
          </span>
        </article>
      </div>

      {lines.length === 0 ? (
        <article className="card house-empty-card">
          <div className="planner-empty-icon">
            <Icon name="trend" size={21} />
          </div>
          <div>
            <h2>{t("investments.emptyTitle")}</h2>
            <p className="muted small">{t("investments.emptyHint")}</p>
          </div>
          <button type="button" className="primary" onClick={() => setDialog({ holding: null })}>
            <Icon name="plus" size={16} />
            {t("investments.new")}
          </button>
        </article>
      ) : (
        <>
          <article className="card">
            <header className="card-head">
              <div className="card-title">
                <h2>{t("investments.allocation")}</h2>
              </div>
            </header>
            <div className="alloc-bar" role="img" aria-label={t("investments.allocation")}>
              {lines.map((line, index) => (
                <span
                  key={line.id}
                  className="alloc-part has-tip"
                  style={{ flexGrow: Math.max(line.valueCents, 1), background: colorOf(index) }}
                >
                  <span className="col-tip" role="tooltip">
                    <strong>{line.name}</strong>
                    <span className="tip-row">
                      {t("investments.value")}
                      <b>{formatCents(line.valueCents)}</b>
                    </span>
                    <span className="tip-row muted">
                      {t("investments.share")}
                      <b>{Math.round(line.sharePct)}%</b>
                    </span>
                  </span>
                </span>
              ))}
            </div>
            <ul className="alloc-legend">
              {lines.map((line, index) => (
                <li key={line.id}>
                  <i className="alloc-dot" style={{ background: colorOf(index) }} />
                  <span className="alloc-name">{line.name}</span>
                  <span className="muted">{Math.round(line.sharePct)}%</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <header className="card-head">
              <div className="card-title">
                <h2>{t("investments.positions")}</h2>
              </div>
            </header>
            <div className="data-table" role="table">
              <div className="data-row data-head" role="row">
                <span role="columnheader">{t("planner.name")}</span>
                <span role="columnheader" className="num">{t("investments.value")}</span>
                <span role="columnheader" className="num">{t("investments.cost")}</span>
                <span role="columnheader" className="num">{t("investments.return")}</span>
                <span role="columnheader" aria-hidden="true" />
              </div>
              {lines.map((line, index) => {
                const holding = holdingOf(line.id);
                return (
                  <div className="data-row" role="row" key={line.id} style={{ "--row-color": colorOf(index) } as CSSProperties}>
                    <span className="data-main" role="cell">
                      <i className="alloc-dot" style={{ background: colorOf(index) }} />
                      <span>
                        <strong>{line.name}</strong>
                        {holding ? (
                          <small className="muted">
                            {t("holdings.updatedOn", { date: formatDate(holding.updatedOn) })}
                          </small>
                        ) : null}
                      </span>
                    </span>
                    <span className="num" role="cell">{formatCents(line.valueCents)}</span>
                    <span className="num muted" role="cell">
                      {line.gainCents === null ? "—" : formatCents(line.costCents)}
                    </span>
                    <span
                      className="num"
                      role="cell"
                      style={
                        line.gainCents === null
                          ? undefined
                          : { color: line.gainCents >= 0 ? "var(--positive)" : "var(--negative)" }
                      }
                    >
                      {line.gainCents === null || line.gainPct === null ? (
                        "—"
                      ) : (
                        <>
                          {signed(line.gainCents)}
                          <small>{percent(line.gainPct, lang)}</small>
                        </>
                      )}
                    </span>
                    <span className="tx-actions" role="cell">
                      <button
                        type="button"
                        className="icon-button"
                        title={t("common.edit")}
                        aria-label={`${t("common.edit")}: ${line.name}`}
                        onClick={() => setDialog({ holding })}
                      >
                        <Icon name="pencil" size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title={t("common.delete")}
                        aria-label={`${t("common.delete")}: ${line.name}`}
                        onClick={() => setConfirmDelete(holding)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        </>
      )}

      {dialog ? (
        <HoldingDialog
          initial={dialog.holding}
          defaultKind="investment"
          onClose={() => setDialog(null)}
          onSave={(input) => {
            onSaveHolding(input);
            setDialog(null);
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog
          title={t("holdings.confirmDeleteTitle", { name: confirmDelete.name })}
          onClose={() => setConfirmDelete(null)}
        >
          <p className="muted">{t("holdings.confirmDeleteDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmDelete(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onDeleteHolding(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              {t("common.delete")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
