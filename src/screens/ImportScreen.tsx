import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { Mascot } from "../components/Mascot";
import { api, type ImportReport, type ImportRow } from "../lib/api";
import { fileName, formatCents, formatDate, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";
import type { KeeperLook } from "../lib/keeper";

export function ImportScreen({
  look,
  onImported,
}: {
  look: KeeperLook;
  onImported: () => void;
}) {
  const { lang, t } = useLanguage();
  const [reports, setReports] = useState<ImportReport[]>([]);
  const [history, setHistory] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshHistory = useCallback(() => {
    api
      .imports()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const importPaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setBusy(true);
      setError("");
      try {
        const next: ImportReport[] = [];
        for (const path of paths) {
          next.push(await api.importOfx(path));
        }
        setReports(next);
        refreshHistory();
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : String(problem));
      } finally {
        setBusy(false);
      }
    },
    [refreshHistory],
  );

  useEffect(() => {
    const unlisten = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      void importPaths(event.payload.paths);
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [importPaths]);

  const pickFile = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "OFX statement", extensions: ["ofx"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await importPaths(paths);
  }, [importPaths]);

  const inserted = reports.reduce((total, report) => total + report.inserted, 0);
  const duplicates = reports.reduce((total, report) => total + report.duplicates, 0);

  return (
    <section className="screen">
      <header className="topbar">
        <div>
          <h1>{t("import.title")}</h1>
        </div>
      </header>

      <div className="import-grid">
        <button type="button" className="dropzone" onClick={() => void pickFile()} disabled={busy}>
          <span className="drop-icon">
            <Icon name="import" size={22} />
          </span>
          <strong>{busy ? t("import.reading") : t("import.dropTitle")}</strong>
          <span className="muted">{t("import.dropDesc")}</span>
        </button>

        <aside className="card how">
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
        <div className="card report">
          <div className="report-head">
            <div className="report-title">
              <Mascot look={look} mood="celebrate" size={56} />
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
