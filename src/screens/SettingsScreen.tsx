import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BUILD_LABEL } from "../lib/build";
import type { UpdaterState } from "../lib/updater";

function statusText(updater: UpdaterState): string {
  switch (updater.status) {
    case "checking":
      return "Checking...";
    case "current":
      return "You are on the latest version.";
    case "available":
      return `Version ${updater.version} build ${updater.build} is available.`;
    case "downloading":
      return updater.progress >= 0 ? `Downloading ${updater.progress}%...` : "Downloading...";
    case "ready":
      return "Installed. Restarting...";
    case "error":
      return updater.error;
    default:
      return "Not checked yet.";
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
          <h1>Settings</h1>
          <p className="muted">Everything local. No account, no server.</p>
        </div>
      </header>

      <article className="panel">
        <h2>Updates</h2>
        <p>
          Version {updater.currentVersion || "0.1.0"} · {BUILD_LABEL}
        </p>
        <p className={updater.status === "error" ? "negative" : "muted"}>{statusText(updater)}</p>

        {updater.status === "downloading" ? (
          <div className="progress">
            <div style={{ width: `${Math.max(4, updater.progress)}%` }} />
          </div>
        ) : null}

        {updater.notes && updater.status === "available" ? (
          <pre className="notes">{updater.notes}</pre>
        ) : null}

        <div className="row">
          <button type="button" onClick={() => void updater.checkNow()} disabled={busy}>
            Check now
          </button>
          {updater.status === "available" ? (
            <button type="button" className="primary" onClick={() => void updater.install()}>
              Download and install
            </button>
          ) : null}
        </div>
      </article>

      <article className="panel">
        <h2>Data</h2>
        <p className="muted">
          The database lives in this file. Back it up so you do not lose your history.
        </p>
        <code className="path">{databasePath || "..."}</code>
      </article>

      <article className="panel">
        <h2>About</h2>
        <p className="muted">
          This app reads OFX statements and stores everything in SQLite on your computer. No
          financial data leaves the machine, and there is no login.
        </p>
      </article>
    </section>
  );
}
