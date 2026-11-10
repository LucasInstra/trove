import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BUILD_LABEL, BUILD_NUMBER } from "../lib/build";
import { LANGUAGES, type Lang } from "../lib/i18n";
import { useLanguage } from "../lib/language";
import type { Translate } from "../lib/i18n";
import type { UpdaterState } from "../lib/updater";

function statusText(updater: UpdaterState, t: Translate): string {
  switch (updater.status) {
    case "checking":
      return t("settings.checking");
    case "current":
      return t("settings.current");
    case "available":
      return t("settings.available", { version: updater.version, build: updater.build });
    case "downloading":
      return updater.progress >= 0
        ? t("settings.downloading", { percent: updater.progress })
        : t("settings.downloadingPlain");
    case "ready":
      return t("settings.ready");
    case "error":
      return updater.error;
    default:
      return t("settings.notChecked");
  }
}

export function SettingsScreen({ updater }: { updater: UpdaterState }) {
  const { lang, setLang, t } = useLanguage();
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
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
        </div>
      </header>

      <article className="card">
        <header className="card-head">
          <h2>{t("settings.language")}</h2>
        </header>
        <p className="muted">{t("settings.languageDesc")}</p>
        <div className="segmented wide">
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={lang === option.value ? "active" : ""}
              onClick={() => setLang(option.value as Lang)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </article>

      <article className="card">
        <header className="card-head">
          <h2>{t("settings.updates")}</h2>
          <span className="pill">build {BUILD_NUMBER}</span>
        </header>

        <div className="kv">
          <span className="kv-label">{t("settings.version")}</span>
          <span>{updater.currentVersion || "0.1.0"}</span>
        </div>
        <div className="kv">
          <span className="kv-label">{t("settings.build")}</span>
          <span>{BUILD_LABEL}</span>
        </div>
        <div className="kv">
          <span className="kv-label">{t("settings.status")}</span>
          <span className={updater.status === "error" ? "negative" : "muted"}>
            {statusText(updater, t)}
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
            {t("settings.checkNow")}
          </button>
          {updater.status === "available" ? (
            <button type="button" className="primary" onClick={() => void updater.install()}>
              {t("settings.install")}
            </button>
          ) : null}
        </div>
      </article>

      <article className="card">
        <header className="card-head">
          <h2>{t("settings.data")}</h2>
        </header>
        <p className="muted">{t("settings.dataDesc")}</p>
        <code className="path">{databasePath || "..."}</code>
      </article>

      <article className="card">
        <header className="card-head">
          <h2>{t("settings.about")}</h2>
        </header>
        <p className="muted">{t("settings.aboutDesc")}</p>
      </article>
    </section>
  );
}
