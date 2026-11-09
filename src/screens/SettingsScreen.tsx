import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BUILD_LABEL, BUILD_NUMBER } from "../lib/build";
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
          <p className="sub">Everything local. No account, no server.</p>
        </div>
      </header>

      <article className="card">
        <header className="card-head">
          <h2>Updates</h2>
          <span className="pill">build {BUILD_NUMBER}</span>
        </header>

        <div className="kv">
          <span className="kv-label">Version</span>
          <span>{updater.currentVersion || "0.1.0"}</span>
        </div>
        <div className="kv">
          <span className="kv-label">Build</span>
          <span>{BUILD_LABEL}</span>
        </div>
        <div className="kv">
          <span className="kv-label">Status</span>
          <span className={updater.status === "error" ? "negative" : "muted"}>
            {statusText(updater)}
          </span>
        </div>

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

      <article className="card">
        <header className="card-head">
          <h2>Data</h2>
        </header>
        <p className="muted">
          The database lives in this file. Back it up so you do not lose your history.
        </p>
        <code className="path">{databasePath || "..."}</code>
      </article>

      <article className="card">
        <header className="card-head">
          <h2>About</h2>
        </header>
        <p className="muted">
          This app reads OFX statements and stores everything in SQLite on your computer. No
          financial data leaves the machine, and there is no login. The only network call is the
          update check against GitHub.
        </p>
      </article>
    </section>
  );
}
