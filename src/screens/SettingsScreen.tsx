import { CryptoCard } from "../components/CryptoCard";
import { ONBOARDING_EVENT } from "../components/Onboarding";
import { hideTips, resetTips } from "../components/ScreenTip";
import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { api, type Account } from "../lib/api";
import { CURRENCIES, currencyLabel, fileName, type DisplayCurrency } from "../lib/format";
import { SalaryAccount } from "../components/SalaryAccount";
import { notesFor } from "../lib/bundledNotes";
import { highlights } from "../lib/highlights";
import { AccountsManager } from "../components/AccountsManager";
import { Dialog } from "../components/Dialog";
import { SectionPage } from "../components/SectionPage";
import { PageHeader } from "./PlannerScreens";
import type { Theme } from "../lib/theme";
import { BUILD_LABEL, BUILD_NUMBER } from "../lib/build";
import { LANGUAGES, type Lang } from "../lib/i18n";
import { useLanguage } from "../lib/language";
import type { Translate } from "../lib/i18n";
import type { UpdaterState } from "../lib/updater";
import { initialsOf, squareAvatar } from "../lib/avatar";

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

export function SettingsScreen({
  initialTab,
  salaryAccountId,
  salaryChoices,
  onSalaryAccount,
  currency,
  onCurrency,
  updater,
  accounts,
  onCreateAccount,
  multiAccounts,
  onMultiAccounts,
  onRenameAccount,
  onArchiveAccount,
  onSaveUserName,
  avatar,
  onAvatar,
  onLoadDemo,
  onRemoveDemo,
  onEraseAll,
  theme,
  onTheme,
}: {
  /** Opens on this tab, e.g. the updates one from the "new version" banner. */
  salaryAccountId: number | undefined;
  salaryChoices: Account[];
  onSalaryAccount: (id: number) => void;
  currency: DisplayCurrency;
  onCurrency: (currency: DisplayCurrency) => void;
  initialTab?: "profile" | "account" | "appearance" | "updates" | "about";
  updater: UpdaterState;
  accounts: Account[];
  onCreateAccount: (name: string) => void;
  multiAccounts: boolean;
  onMultiAccounts: (on: boolean) => void;
  onRenameAccount: (id: number, name: string) => void;
  onArchiveAccount: (id: number) => void;
  onSaveUserName: (name: string | null) => void;
  avatar: string | null;
  onAvatar: (next: string | null) => void;
  onLoadDemo: () => Promise<void>;
  onRemoveDemo: () => Promise<void>;
  onEraseAll: () => Promise<void>;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}) {
  const { lang, setLang, t } = useLanguage();
  // The highlights of the version that is installed, shown in the updates tab.
  const installedNotes = updater.currentVersion ? notesFor(updater.currentVersion, lang) : null;
  const [databasePath, setDatabasePath] = useState("");
  const [userName, setUserName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState("");
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseWord, setEraseWord] = useState("");
  const [tab, setTab] = useState<"profile" | "account" | "appearance" | "updates" | "about">(initialTab ?? "profile");
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [pathCopied, setPathCopied] = useState(false);

  useEffect(() => {
    api
      .databaseLocation()
      .then(setDatabasePath)
      .catch(() => setDatabasePath(""));
    api
      .demoLoaded()
      .then(setDemoLoaded)
      .catch(() => {});
    api
      .getSetting("user_name")
      .then((stored) => {
        if (stored) {
          setUserName(stored);
          setSavedName(stored);
        }
      })
      .catch(() => {});
  }, []);

  const saveName = async () => {
    const value = userName.trim();
    if (savingName || value === savedName) return;
    setSavingName(true);
    setNameSaved(false);
    setNameError("");
    try {
      await api.setSetting("user_name", value);
      setUserName(value);
      setSavedName(value);
      onSaveUserName(value || null);
      setNameSaved(true);
    } catch (problem) {
      setNameError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setSavingName(false);
    }
  };

  const busy = updater.status === "checking" || updater.status === "downloading";

  const [dataBusy, setDataBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [restorePick, setRestorePick] = useState("");

  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const doBackup = async () => {
    setDataMessage("");
    setDataError("");
    const dest = await save({
      defaultPath: `trove-backup-${today()}.db`,
      filters: [{ name: "SQLite database", extensions: ["db"] }],
    });
    if (!dest) return;
    setDataBusy(true);
    try {
      await api.backupDatabase(dest);
      setDataMessage(t("settings.backedUp"));
    } catch (problem) {
      setDataError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setDataBusy(false);
    }
  };

  const pickRestore = async () => {
    setDataMessage("");
    setDataError("");
    const selected = await open({
      multiple: false,
      filters: [{ name: "SQLite database", extensions: ["db"] }],
    });
    if (typeof selected === "string") setRestorePick(selected);
  };

  // The backend validates the file before it touches the live database, then
  // the app relaunches onto the restored file so no stale handle survives.
  const doRestore = async () => {
    if (!restorePick) return;
    setDataBusy(true);
    setDataError("");
    try {
      await api.restoreDatabase(restorePick);
      await relaunch();
    } catch (problem) {
      setDataError(problem instanceof Error ? problem.message : String(problem));
      setDataBusy(false);
    }
  };

  return (
    <section className="screen planner-screen">
      <SectionPage
        eyebrow={t("nav.settingsGroup")}
        tabs={[
          { id: "profile", label: t("settings.tabProfile") },
          { id: "appearance", label: t("settings.tabAppearance") },
          { id: "account", label: t("settings.tabAccount") },
          { id: "updates", label: t("settings.tabUpdates") },
          { id: "about", label: t("settings.tabAbout") },
        ]}
        active={tab}
        onTab={setTab}
      >
      <PageHeader
        eyebrow={t("nav.settingsGroup")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <article className="card" hidden={tab !== "appearance"}>
        <header className="card-head">
          <h2>{t("settings.appearance")}</h2>
        </header>
        <p className="muted">{t("settings.appearanceDesc")}</p>
        <div className="segmented wide">
          {(["light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={theme === option ? "active" : ""}
              aria-pressed={theme === option}
              onClick={() => onTheme(option)}
            >
              {option === "light" ? t("settings.themeLight") : t("settings.themeDark")}
            </button>
          ))}
        </div>
      </article>

      <article className="card" hidden={tab !== "appearance"}>
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

      <article className="card" hidden={tab !== "appearance"}>
        <header className="card-head">
          <h2>{t("settings.currency")}</h2>
        </header>
        <p className="muted">{t("settings.currencyDesc")}</p>
        <select value={currency} onChange={(event) => onCurrency(event.target.value as DisplayCurrency)}>
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {currencyLabel(code, lang)}
            </option>
          ))}
        </select>
      </article>

      <div hidden={tab !== "updates"}>
        <CryptoCard />
      </div>

      <div hidden={tab !== "profile"}>
        <article className="card">
          <header className="card-head">
            <div className="card-title">
              <h2>{t("onboard.redoTitle")}</h2>
            </div>
          </header>
          <p className="muted small">{t("onboard.redoDesc")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="outline-button" onClick={() => {
              void resetTips();
              window.dispatchEvent(new Event(ONBOARDING_EVENT));
            }}>
            {t("onboard.redo")}
          </button>
          <button type="button" className="outline-button" onClick={() => void hideTips()}>
            {t("onboard.hideTips")}
          </button>
          </div>
        </article>
      </div>

      <article className="card" hidden={tab !== "profile"}>
        <header className="card-head">
          <h2>{t("settings.profile")}</h2>
        </header>
        <div className="avatar-picker">
          <span className="avatar-preview" aria-hidden="true">
            {avatar ? <img src={avatar} alt="" /> : initialsOf(userName || savedName) || "?"}
          </span>
          <div className="avatar-actions">
            <label className="outline-button avatar-choose">
              {t("settings.photoChoose")}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setNameError("");
                  squareAvatar(file)
                    .then(onAvatar)
                    .catch(() => setNameError(t("settings.photoError")));
                }}
              />
            </label>
            {avatar ? (
              <button type="button" className="ghost" onClick={() => onAvatar(null)}>
                {t("settings.photoRemove")}
              </button>
            ) : null}
            <span className="muted small">{t("settings.photoHint")}</span>
          </div>
        </div>
        <label className="field">
          <span>{t("settings.userName")}</span>
          <input
            value={userName}
            maxLength={40}
            placeholder={t("settings.userNamePlaceholder")}
            onChange={(event) => {
              setUserName(event.target.value);
              setNameSaved(false);
              setNameError("");
            }}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveName();
              }
            }}
          />
        </label>
        <div className="row settings-profile-actions">
          <button
            type="button"
            className="primary"
            disabled={savingName || userName.trim() === savedName}
            onClick={() => void saveName()}
          >
            {savingName ? t("settings.savingProfile") : t("common.save")}
          </button>
          {nameSaved ? (
            <span className="muted small" role="status">
              {t("settings.profileSaved")}
            </span>
          ) : null}
        </div>
        {nameError ? (
          <div className="alert" role="alert">
            {nameError}
          </div>
        ) : null}
      </article>

      <article className="card" hidden={tab !== "updates"}>
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
          <ul className="whatsnew-list">
            {highlights(lang === "pt" && updater.notesPt ? updater.notesPt : updater.notes).map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                {item.detail ? <span className="muted small"> {item.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {installedNotes && updater.status !== "available" ? (
          <>
            <h3 className="whatsnew-title">{t("whatsnew.title", { version: updater.currentVersion })}</h3>
            {installedNotes.summary ? <p className="muted small">{installedNotes.summary}</p> : null}
            <ul className="whatsnew-list">
              {installedNotes.items.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  {item.detail ? <span className="muted small"> {item.detail}</span> : null}
                </li>
              ))}
            </ul>
          </>
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

      <article className="card" hidden={tab !== "account"}>
        <header className="card-head">
          <h2>{t("accounts.multiTitle")}</h2>
        </header>
        <label className="check">
          <input type="checkbox" checked={multiAccounts} onChange={(event) => onMultiAccounts(event.target.checked)} />
          {t("accounts.multiLabel")}
        </label>
        <p className="muted small">{t("accounts.multiDesc")}</p>
      </article>

      <div hidden={tab !== "account" || !multiAccounts}>
        <SalaryAccount accounts={salaryChoices} value={salaryAccountId} onChange={onSalaryAccount} />
        <AccountsManager
          accounts={accounts}
          onCreate={onCreateAccount}
          onRename={onRenameAccount}
          onArchive={onArchiveAccount}
        />
      </div>

      <article className="card" hidden={tab !== "account"}>
        <header className="card-head">
          <h2>{t("settings.data")}</h2>
        </header>
        <p className="muted">{t("settings.dataDesc")}</p>
        <code className="path">{databasePath || "..."}</code>
        <div className="row">
          <button
            type="button"
            className="outline-button small-button"
            disabled={!databasePath}
            onClick={() => {
              void navigator.clipboard
                .writeText(databasePath)
                .then(() => setPathCopied(true))
                .catch(() => setPathCopied(false));
            }}
          >
            {pathCopied ? t("settings.pathCopied") : t("settings.copyPath")}
          </button>
        </div>
        <div className="row">
          <button type="button" onClick={() => void doBackup()} disabled={dataBusy}>
            {t("settings.backup")}
          </button>
          <button type="button" className="ghost" onClick={() => void pickRestore()} disabled={dataBusy}>
            {t("settings.restore")}
          </button>
        </div>
        {dataMessage ? <p className="muted">{dataMessage}</p> : null}
        {dataError ? (
          <div className="alert" role="alert">
            {dataError}
          </div>
        ) : null}
        {restorePick ? (
          <div className="alert" role="alert">
            <p>{t("settings.restoreConfirm", { file: fileName(restorePick) })}</p>
            <div className="dialog-actions">
              <button type="button" className="ghost" onClick={() => setRestorePick("")}>
                {t("common.cancel")}
              </button>
              <button type="button" className="primary" onClick={() => void doRestore()}>
                {t("settings.restore")}
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <details className="card demo-details" hidden={tab !== "account"}>
        <summary>{t("settings.demo")}</summary>
        <p className="muted">{t("settings.demoDesc")}</p>
        <div className="onboarding-actions">
          {demoLoaded ? (
            <button
              type="button"
              className="ghost danger"
              disabled={demoBusy}
              onClick={async () => {
                if (!window.confirm(t("settings.demoRemoveConfirm"))) return;
                setDemoBusy(true);
                try {
                  await onRemoveDemo();
                  setDemoLoaded(false);
                } finally {
                  setDemoBusy(false);
                }
              }}
            >
              {t("settings.demoRemove")}
            </button>
          ) : (
            <button
              type="button"
              className="outline-button"
              disabled={demoBusy}
              onClick={async () => {
                setDemoBusy(true);
                try {
                  await onLoadDemo();
                  setDemoLoaded(true);
                } finally {
                  setDemoBusy(false);
                }
              }}
            >
              {t("settings.demoLoad")}
            </button>
          )}
        </div>
      </details>

      <article className="card" hidden={tab !== "account"}>
        <header className="card-head">
          <h2>{t("settings.erase")}</h2>
        </header>
        <p className="muted">{t("settings.eraseDesc")}</p>
        <button
          type="button"
          className="ghost danger"
          onClick={() => {
            setEraseWord("");
            setEraseOpen(true);
          }}
        >
          {t("settings.eraseButton")}
        </button>
      </article>

      {eraseOpen ? (
        <Dialog title={t("settings.eraseTitle")} onClose={() => setEraseOpen(false)}>
          <p className="muted">{t("settings.eraseConfirm", { word: t("settings.eraseWord") })}</p>
          <input
            value={eraseWord}
            onChange={(event) => setEraseWord(event.target.value)}
            aria-label={t("settings.eraseWord")}
            autoFocus
          />
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setEraseOpen(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              disabled={demoBusy || eraseWord.trim().toLowerCase() !== t("settings.eraseWord").toLowerCase()}
              onClick={async () => {
                setDemoBusy(true);
                try {
                  await onEraseAll();
                  setDemoLoaded(false);
                  setEraseOpen(false);
                } finally {
                  setDemoBusy(false);
                }
              }}
            >
              {t("settings.eraseButton")}
            </button>
          </div>
        </Dialog>
      ) : null}

      <article className="card" hidden={tab !== "about"}>
        <header className="card-head">
          <h2>{t("settings.about")}</h2>
        </header>
        <p className="muted">{t("settings.aboutDesc")}</p>
      </article>
      </SectionPage>
    </section>
  );
}
