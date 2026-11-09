import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BUILD_LABEL } from "../lib/build";
import type { UpdaterState } from "../lib/updater";

function statusText(updater: UpdaterState): string {
  switch (updater.status) {
    case "checking":
      return "Verificando...";
    case "current":
      return "Você está na versão mais recente.";
    case "available":
      return `Versão ${updater.version} build ${updater.build} disponível.`;
    case "downloading":
      return updater.progress >= 0
        ? `Baixando ${updater.progress}%...`
        : "Baixando...";
    case "ready":
      return "Instalado. Reiniciando o cofre...";
    case "error":
      return updater.error;
    default:
      return "Ainda não verificado.";
  }
}

export function SettingsScreen({ updater }: { updater: UpdaterState }) {
  const [databasePath, setDatabasePath] = useState("");

  useEffect(() => {
    api
      .databaseLocation()
      .then(setDatabasePath)
      .catch(() => setDatabasePath(""));
  }, []);

  const busy = updater.status === "checking" || updater.status === "downloading";

  return (
    <section className="screen">
      <header className="screen-head">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Tudo local. Nenhuma conta, nenhum servidor.</p>
        </div>
      </header>

      <article className="panel">
        <h2>Atualizações</h2>
        <p>
          Versão {updater.currentVersion || "0.1.0"} · {BUILD_LABEL}
        </p>
        <p className={updater.status === "error" ? "negative" : "muted"}>
          {statusText(updater)}
        </p>

        {updater.status === "downloading" ? (
          <div className="progress">
            <div style={{ width: `${Math.max(4, updater.progress)}%` }} />
          </div>
        ) : null}

        {updater.notes && updater.status === "available" ? (
          <pre className="notes">{updater.notes}</pre>
        ) : null}

        <div className="row">
          <button
            type="button"
            onClick={() => void updater.checkNow()}
            disabled={busy}
          >
            Verificar agora
          </button>
          {updater.status === "available" ? (
            <button type="button" className="primary" onClick={() => void updater.install()}>
              Baixar e instalar
            </button>
          ) : null}
        </div>
      </article>

      <article className="panel">
        <h2>Dados</h2>
        <p className="muted">
          O banco fica neste arquivo. Faça backup dele para não perder o histórico.
        </p>
        <code className="path">{databasePath || "..."}</code>
      </article>

      <article className="panel">
        <h2>Sobre</h2>
        <p className="muted">
          O cofre lê extratos OFX e guarda tudo em SQLite no seu computador. Nenhum dado
          financeiro sai da máquina, e não existe login.
        </p>
      </article>
    </section>
  );
}
