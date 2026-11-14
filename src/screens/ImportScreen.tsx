import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { IconBubble } from "../components/editorial";
import { CsvImport } from "../components/CsvImport";
import { api, type ImportReport, type ImportRow, type OfxPreview } from "../lib/api";
import { fileName, formatCents, formatDate, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";

export function ImportScreen({
  onImported,
}: {
  onImported: () => void;
}) {
  const { lang, t } = useLanguage();
  const [tab, setTab] = useState<"ofx" | "csv">("ofx");
  const [reports, setReports] = useState<ImportReport[]>([]);
  const [previews, setPreviews] = useState<Array<{ path: string; preview: OfxPreview }>>([]);
  const [history, setHistory] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof api.accounts>>>([]);

  const refreshHistory = useCallback(() => {
    api
      .imports()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    refreshHistory();
    api
      .accounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, [refreshHistory]);

  // Step 2: read the files and show what importing them would do, writing nothing.
  const previewPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setBusy(true);
    setError("");
    setReports([]);
    try {
      const next: Array<{ path: string; preview: OfxPreview }> = [];
      for (const path of paths) {
        next.push({ path, preview: await api.previewOfx(path) });
      }
      setPreviews(next);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  }, []);

  // Step 3: the actual import, only after the preview was confirmed.
  const confirmImport = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const next: ImportReport[] = [];
      for (const { path } of previews) {
        next.push(await api.importOfx(path));
      }
      setReports(next);
      setPreviews([]);
      refreshHistory();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  }, [previews, refreshHistory]);

  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      void previewPaths(event.payload.paths);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [previewPaths]);

  const pickFile = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "OFX statement", extensions: ["ofx"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await previewPaths(paths);
  }, [previewPaths]);

  const step = reports.length > 0 ? 3 : busy && previews.length > 0 ? 2 : previews.length > 0 ? 1 : 0;
  const stepLabels = [
    t("import.stepPick"),
    t("import.stepPreview"),
    t("import.stepImport"),
    t("import.stepDone"),
  ];
  const newTotal = previews.reduce((total, item) => total + item.preview.newCount, 0);
  const inserted = reports.reduce((total, report) => total + report.inserted, 0);
  const duplicates = reports.reduce((total, report) => total + report.duplicates, 0);

  return (
    <section className="screen">
      <header className="topbar">
        <div>
          <h1>{t("import.title")}</h1>
        </div>
        <div className="segmented" role="group" aria-label={t("import.title")}>
          <button
            type="button"
            className={tab === "ofx" ? "active" : undefined}
            aria-pressed={tab === "ofx"}
            onClick={() => setTab("ofx")}
          >
            OFX
          </button>
          <button
            type="button"
            className={tab === "csv" ? "active" : undefined}
            aria-pressed={tab === "csv"}
            onClick={() => setTab("csv")}
          >
            CSV
          </button>
        </div>
      </header>

      {tab === "ofx" ? (
        <ol className="import-stepper" aria-label={t("import.title")}>
          {stepLabels.map((label, index) => (
            <li
              key={label}
              className={index < step ? "is-done" : index === step ? "is-active" : undefined}
              aria-current={index === step ? "step" : undefined}
            >
              <span className="import-stepper-dot">
                {index < step ? <Icon name="check" size={12} /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      ) : null}

      {tab === "csv" ? (
        <CsvImport
          accounts={accounts}
          onImported={() => {
            refreshHistory();
          }}
        />
      ) : previews.length > 0 ? (
        <div className="import-preview">
          {previews.map(({ path, preview }) => (
            <article className="card" key={path}>
              <header className="card-head">
                <div className="card-title">
                  <h2>{t("import.previewTitle")}</h2>
                </div>
                <span className="muted small" title={path}>
                  {t("import.fileFrom", { file: fileName(path) })}
                </span>
              </header>
              <p>
                <strong>{preview.accountName}</strong>{" "}
                <span className="muted">
                  {t("import.previewLine", {
                    count: preview.total,
                    from: preview.firstOn ? formatDate(preview.firstOn) : "",
                    to: preview.lastOn ? formatDate(preview.lastOn) : "",
                  })}
                </span>
              </p>
              <p className="import-preview-counts">
                <span className="pill-soft">{t("import.previewNew", { count: preview.newCount })}</span>
                <span className="pill-soft">{t("import.previewDup", { count: preview.duplicates })}</span>
              </p>
              <h3 className="muted small">{t("import.previewSample")}</h3>
              <ul className="history">
                {preview.sample.map((row, index) => (
                  <li key={`${row.postedOn}-${index}`}>
                    <span className="muted small">{formatDate(row.postedOn)}</span>
                    <span className="history-file">{row.description}</span>
                    <span className="history-count">{formatCents(row.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {newTotal === 0 ? <p className="muted">{t("import.nothingNew")}</p> : null}
          <div className="import-preview-actions">
            <button type="button" className="ghost" onClick={() => setPreviews([])} disabled={busy}>
              {t("import.back")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void confirmImport()}
              disabled={busy || newTotal === 0}
            >
              {busy ? t("import.importing") : t("import.confirm", { count: newTotal })}
            </button>
          </div>
        </div>
      ) : (
      <div className="import-grid">
        <button type="button" className="dropzone" onClick={() => void pickFile()} disabled={busy}>
          <IconBubble name="checklist" size="md" />
          <strong>{busy ? t("import.reading") : t("import.dropTitle")}</strong>
          <span className="muted">{t("import.dropDesc")}</span>
        </button>

        <aside className="how paper-band">
          <h2>{t("import.howTitle")}</h2>
          <ol className="steps">
            <li>
              <span className="step-number">1</span>
              <div>
                <strong>{t("import.step1Title")}</strong>
                <span className="muted">{t("import.step1Desc")}</span>
              </div>
            </li>
            <li>
              <span className="step-number">2</span>
              <div>
                <strong>{t("import.step2Title")}</strong>
                <span className="muted">{t("import.step2Desc")}</span>
              </div>
            </li>
            <li>
              <span className="step-number">3</span>
              <div>
                <strong>{t("import.step3Title")}</strong>
                <span className="muted">{t("import.step3Desc")}</span>
              </div>
            </li>
          </ol>
        </aside>
      </div>
      )}

      {history.length > 0 ? (
        <article className="card">
          <header className="card-head">
            <h2>{t("import.historyTitle")}</h2>
            <span className="muted">{t("import.historyDesc")}</span>
          </header>
          <ul className="history">
            {history.map((row) => (
              <li key={row.id}>
                <span className="history-file">
                  <Icon name="file" size={14} />
                  {fileName(row.path)}
                </span>
                <span className="muted small">{row.accountName}</span>
                <span className="muted small">{formatDateTime(row.importedAt, lang)}</span>
                <span className="history-count">
                  {t("import.historyLine", {
                    inserted: row.inserted,
                    duplicates: row.duplicates,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {error ? (
        <div className="alert" role="alert">
          {error}
        </div>
      ) : null}

      {reports.length > 0 ? (
        <div className="card report paper-band">
          <div className="report-head">
            <div className="report-title">
              <IconBubble name="trophy" size="md" />
              <div>
                <h2>{t("import.reportTitle", { count: inserted })}</h2>
                <p className="muted">
                  {duplicates > 0
                    ? t("import.reportSkipped", { count: duplicates })
                    : t("import.reportNone")}
                </p>
              </div>
            </div>
            <button type="button" className="primary" onClick={onImported}>
              {t("import.seeLedger")}
            </button>
          </div>

          <ul className="report-list">
            {reports.map((report, index) => (
              <li key={`${report.accountId}-${index}`}>
                <span className="report-check">
                  <Icon name="check" size={14} />
                </span>
                <div className="report-main">
                  <strong>{report.accountName}</strong>
                  <span className="muted">
                    {t("import.reportLine", {
                      inserted: report.inserted,
                      duplicates: report.duplicates,
                    })}
                    {report.categorized > 0
                      ? ` · ${t("import.categorizedLine", { count: report.categorized })}`
                      : ""}
                  </span>
                </div>
                {report.ledgerBalanceCents !== null ? (
                  <div className="right">
                    <strong>{formatCents(report.ledgerBalanceCents)}</strong>
                    <span className="muted small">
                      {t("import.balanceOn", {
                        date: report.ledgerBalanceOn ? formatDate(report.ledgerBalanceOn) : "",
                      })}
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
