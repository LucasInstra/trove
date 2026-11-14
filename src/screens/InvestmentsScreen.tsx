import { useEffect, useState, type CSSProperties } from "react";
import { Dialog } from "../components/Dialog";
import { Icon } from "../components/Icons";
import { HoldingDialog, ScreenHeader } from "./PlannerScreens";
import { DEFAULT_RATES, investmentLines, investmentSummary, type RateAssumptions } from "../domain/patrimony";
import { api, type Holding, type HoldingInput } from "../lib/api";
import { formatCents } from "../lib/format";
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

  const [rates, setRates] = useState<RateAssumptions>(DEFAULT_RATES);
  useEffect(() => {
    let alive = true;
    void Promise.all([api.getSetting("rate_cdi"), api.getSetting("rate_ipca")])
      .then(([cdi, ipca]) => {
        if (!alive) return;
        setRates({
          cdiPct: Number(cdi) > 0 ? Number(cdi) : DEFAULT_RATES.cdiPct,
          ipcaPct: Number(ipca) > 0 ? Number(ipca) : DEFAULT_RATES.ipcaPct,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const saveRate = (key: "cdiPct" | "ipcaPct", raw: string) => {
    const value = Number(raw.replace(",", "."));
    if (!(value > 0 && value < 100)) return;
    setRates((current) => ({ ...current, [key]: value }));
    void api.setSetting(key === "cdiPct" ? "rate_cdi" : "rate_ipca", String(value)).catch(() => undefined);
  };

  const lines = investmentLines(holdings, rates);
  const summary = investmentSummary(lines);
  const colorOf = (index: number) => SERIES[index % SERIES.length];
  const holdingOf = (id: number) => holdings.find((holding) => holding.id === id) ?? null;
  const up = summary.gainCents >= 0;
  const terms = (line: (typeof lines)[number]): string => {
    const parts: string[] = [];
    if (line.annualRate !== null) {
      const pct = line.rateBps / 100;
      parts.push(
        t(`investments.short_${line.indexer}`, {
          rate: new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 2 }).format(pct),
        }),
      );
    }
    if (line.monthsLeft !== null) {
      parts.push(
        line.monthsLeft > 0
          ? t("investments.monthsLeft", { count: line.monthsLeft })
          : t("investments.matured"),
      );
    }
    return parts.length > 0 ? parts.join(" · ") : t("investments.noTerms");
  };

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
        <article className="card metric-card">
          <span className="metric-label">{t("investments.monthlyYield")}</span>
          <strong className="metric-value">
            {summary.withRate > 0 ? `~${formatCents(summary.monthlyYieldCents)}` : "—"}
          </strong>
          <span className="metric-note">
            {summary.withRate > 0
              ? t("investments.yieldNote", { count: summary.withRate })
              : t("investments.yieldNone")}
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
                        <small className="muted">{terms(line)}</small>
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

          <article className="card">
            <header className="card-head">
              <div className="card-title">
                <h2>{t("investments.assumptions")}</h2>
              </div>
            </header>
            <p className="muted small">{t("investments.assumptionsHint")}</p>
            <div className="form-grid">
              <label className="field">
                <span>{t("investments.cdiYear")}</span>
                <span className="input-affix">
                  <input
                    key={`cdi-${rates.cdiPct}`}
                    defaultValue={String(rates.cdiPct)}
                    inputMode="decimal"
                    onBlur={(event) => saveRate("cdiPct", event.target.value)}
                  />
                  <span>%</span>
                </span>
              </label>
              <label className="field">
                <span>{t("investments.ipcaYear")}</span>
                <span className="input-affix">
                  <input
                    key={`ipca-${rates.ipcaPct}`}
                    defaultValue={String(rates.ipcaPct)}
                    inputMode="decimal"
                    onBlur={(event) => saveRate("ipcaPct", event.target.value)}
                  />
                  <span>%</span>
                </span>
              </label>
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
