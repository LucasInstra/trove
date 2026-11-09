import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
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
      filters: [{ name: "Extrato OFX", extensions: ["ofx"] }],
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
          <h1>Importar</h1>
          <p className="muted">Arraste um ou mais arquivos OFX, ou escolha no computador.</p>
        </div>
      </header>

      <button type="button" className="dropzone" onClick={() => void pickFile()} disabled={busy}>
        <strong>{busy ? "Lendo o arquivo..." : "Solte o extrato aqui"}</strong>
        <span className="muted">ou clique para escolher. Aceita vários arquivos de uma vez.</span>
      </button>

      {error ? <div className="alert">{error}</div> : null}

      {reports.length > 0 ? (
        <div className="report">
          <div className="report-head">
            <div>
              <h2>
                {inserted} lançamento{inserted === 1 ? "" : "s"} novo{inserted === 1 ? "" : "s"}
              </h2>
              <p className="muted">
                {duplicates > 0
                  ? `${duplicates} já estavam no cofre e foram ignorados.`
                  : "Nada estava duplicado."}
              </p>
            </div>
            <button type="button" className="primary" onClick={onImported}>
              Ver extrato
            </button>
          </div>

          <ul className="report-list">
            {reports.map((report, index) => (
              <li key={`${report.accountId}-${index}`}>
                <div>
                  <strong>{report.accountName}</strong>
                  <span className="muted">
                    {report.inserted} novos, {report.duplicates} repetidos
                  </span>
                </div>
                {report.ledgerBalanceCents !== null ? (
                  <div className="right">
                    <strong>{formatCents(report.ledgerBalanceCents)}</strong>
                    <span className="muted">
                      saldo em {report.ledgerBalanceOn ? formatDate(report.ledgerBalanceOn) : ""}
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
