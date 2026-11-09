import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import { api, type ImportReport } from "../lib/api";
import { formatCents, formatDate } from "../lib/format";

export function ImportScreen({ onImported }: { onImported: () => void }) {
  const [reports, setReports] = useState<ImportReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const importPaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const next: ImportReport[] = [];
      for (const path of paths) {
        next.push(await api.importOfx(path));
      }
      setReports(next);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  }, []);

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
      <header className="screen-head">
        <div>
          <h1>Import</h1>
          <p className="sub">Bring in the statement your bank already gives you.</p>
        </div>
      </header>

      <div className="import-grid">
        <button type="button" className="dropzone" onClick={() => void pickFile()} disabled={busy}>
          <span className="drop-icon">
            <Icon name="import" size={22} />
          </span>
          <strong>{busy ? "Reading the file..." : "Drop your statement here"}</strong>
          <span className="muted">
            or click to choose. OFX 1.x and 2.x, as many files as you want.
          </span>
        </button>

        <aside className="card how">
          <h2>How it works</h2>
          <ol className="steps">
            <li>
              <span className="step-number">1</span>
              <div>
                <strong>Download the OFX file</strong>
                <span className="muted">Every Brazilian bank offers it, usually under "export statement".</span>
              </div>
            </li>
            <li>
              <span className="step-number">2</span>
              <div>
                <strong>Drop it here</strong>
                <span className="muted">The account, dates and amounts come from the file itself.</span>
              </div>
            </li>
            <li>
              <span className="step-number">3</span>
              <div>
                <strong>Import again whenever you want</strong>
                <span className="muted">The same entry is never stored twice, even if the periods overlap.</span>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      {error ? (
        <div className="alert" role="alert">
          {error}
        </div>
      ) : null}

      {reports.length > 0 ? (
        <div className="card report">
          <div className="report-head">
            <div>
              <h2>
                {inserted} new {inserted === 1 ? "entry" : "entries"}
              </h2>
              <p className="muted">
                {duplicates > 0
                  ? `${duplicates} were already in the ledger and were skipped.`
                  : "Nothing was duplicated."}
              </p>
            </div>
            <button type="button" className="primary" onClick={onImported}>
              See ledger
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
                    {report.inserted} new, {report.duplicates} repeated
                  </span>
                </div>
                {report.ledgerBalanceCents !== null ? (
                  <div className="right">
                    <strong>{formatCents(report.ledgerBalanceCents)}</strong>
                    <span className="muted small">
                      balance on {report.ledgerBalanceOn ? formatDate(report.ledgerBalanceOn) : ""}
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
