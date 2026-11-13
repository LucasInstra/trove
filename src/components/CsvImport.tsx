import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { api, type Account, type CsvMapping, type CsvPreview, type CsvProfile } from "../lib/api";
import { fileName, formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";

const DEFAULT_MAPPING: CsvMapping = {
  separator: ";",
  encoding: "auto",
  hasHeader: true,
  dateCol: 0,
  dateFormat: "%d/%m/%Y",
  descriptionCol: 1,
  amountCol: 2,
  debitCol: null,
  creditCol: null,
  decimalSep: ",",
};

/**
 * A bank CSV import: pick a file, describe its layout, preview what the
 * parser sees, then import into one account. Layouts can be saved per bank
 * so the next file from the same bank is two clicks.
 */
export function CsvImport({ accounts, onImported }: { accounts: Account[]; onImported: () => void }) {
  const { t } = useLanguage();
  const [path, setPath] = useState("");
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id ?? 0);
  const [mapping, setMapping] = useState<CsvMapping>(DEFAULT_MAPPING);
  const [split, setSplit] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [profiles, setProfiles] = useState<CsvProfile[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");

  useEffect(() => {
    setAccountId(accounts[0]?.id ?? 0);
  }, [accounts]);

  const refreshProfiles = useCallback(() => {
    api
      .csvProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  // Preview is cheap and local, so it follows every mapping keystroke with a
  // short debounce instead of waiting for a button.
  useEffect(() => {
    if (!path) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    const active: CsvMapping = split
      ? { ...mapping, amountCol: null }
      : { ...mapping, debitCol: null, creditCol: null };
    const timer = setTimeout(() => {
      api
        .previewCsv(path, active)
        .then((next) => {
          setPreview(next);
          setPreviewError("");
        })
        .catch((problem) => {
          setPreview(null);
          setPreviewError(problem instanceof Error ? problem.message : String(problem));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [path, mapping, split]);

  const set = <K extends keyof CsvMapping>(key: K, value: CsvMapping[K]) =>
    setMapping((current) => ({ ...current, [key]: value }));

  const pickFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "CSV statement", extensions: ["csv", "txt"] }],
    });
    if (typeof selected === "string") {
      setPath(selected);
      setReport("");
      setError("");
    }
  }, []);

  const applyProfile = (id: number | null) => {
    setProfileId(id);
    if (id === null) {
      setMapping(DEFAULT_MAPPING);
      setSplit(false);
      return;
    }
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setMapping({
      separator: profile.separator,
      encoding: profile.encoding,
      hasHeader: profile.hasHeader,
      dateCol: profile.dateCol,
      dateFormat: profile.dateFormat,
      descriptionCol: profile.descriptionCol,
      amountCol: profile.amountCol,
      debitCol: profile.debitCol,
      creditCol: profile.creditCol,
      decimalSep: profile.decimalSep,
    });
    setSplit(profile.amountCol === null);
  };

  const saveProfile = async () => {
    const name = profileName.trim();
    if (!name) return;
    const active: CsvMapping = split
      ? { ...mapping, amountCol: null }
      : { ...mapping, debitCol: null, creditCol: null };
    try {
      await api.saveCsvProfile({ ...active, name });
      setProfileName("");
      refreshProfiles();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const removeProfile = async () => {
    if (profileId === null) return;
    try {
      await api.deleteCsvProfile(profileId);
      setProfileId(null);
      setMapping(DEFAULT_MAPPING);
      setSplit(false);
      refreshProfiles();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };

  const doImport = async () => {
    if (!path || accountId === 0) return;
    const active: CsvMapping = split
      ? { ...mapping, amountCol: null }
      : { ...mapping, debitCol: null, creditCol: null };
    setBusy(true);
    setError("");
    try {
      const result = await api.importCsv(path, accountId, active);
      setReport(t("csv.done", { inserted: result.inserted, duplicates: result.duplicates, skipped: result.skipped }));
      onImported();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-grid">
      <div className="card">
        <header className="card-head">
          <h2>{t("csv.title")}</h2>
          <span className="muted">{t("csv.desc")}</span>
        </header>

        <button type="button" className="dropzone" onClick={() => void pickFile()} disabled={busy}>
          <strong>{path ? fileName(path) : t("csv.pick")}</strong>
          {!path ? <span className="muted">{t("csv.pickHint")}</span> : null}
        </button>

        <label className="field">
          <span>{t("planner.account")}</span>
          <select value={accountId} onChange={(event) => setAccountId(Number(event.target.value))}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <div className="segmented" role="group" aria-label={t("csv.amountMode")}>
          <button
            type="button"
            className={!split ? "active" : undefined}
            aria-pressed={!split}
            onClick={() => setSplit(false)}
          >
            {t("csv.singleAmount")}
          </button>
          <button
            type="button"
            className={split ? "active" : undefined}
            aria-pressed={split}
            onClick={() => setSplit(true)}
          >
            {t("csv.debitCredit")}
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>{t("csv.separator")}</span>
            <select value={mapping.separator} onChange={(event) => set("separator", event.target.value)}>
              <option value=";">;</option>
              <option value=",">,</option>
              <option value={"\t"}>{t("csv.tab")}</option>
              <option value="|">|</option>
            </select>
          </label>
          <label className="field">
            <span>{t("csv.decimal")}</span>
            <select value={mapping.decimalSep} onChange={(event) => set("decimalSep", event.target.value)}>
              <option value=",">,</option>
              <option value=".">.</option>
            </select>
          </label>
          <label className="field">
            <span>{t("csv.encoding")}</span>
            <select value={mapping.encoding} onChange={(event) => set("encoding", event.target.value)}>
              <option value="auto">auto</option>
              <option value="utf-8">UTF-8</option>
              <option value="latin1">Latin-1</option>
              <option value="windows-1252">Windows-1252</option>
            </select>
          </label>
          <label className="field">
            <span>{t("csv.dateFormat")}</span>
            <select value={mapping.dateFormat} onChange={(event) => set("dateFormat", event.target.value)}>
              <option value="%d/%m/%Y">DD/MM/AAAA</option>
              <option value="%Y-%m-%d">AAAA-MM-DD</option>
              <option value="%d-%m-%Y">DD-MM-AAAA</option>
              <option value="%m/%d/%Y">MM/DD/AAAA</option>
            </select>
          </label>
          <label className="field">
            <span>{t("csv.dateCol")}</span>
            <input
              type="number"
              min={0}
              value={mapping.dateCol}
              onChange={(event) => set("dateCol", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>{t("csv.descCol")}</span>
            <input
              type="number"
              min={0}
              value={mapping.descriptionCol}
              onChange={(event) => set("descriptionCol", Number(event.target.value))}
            />
          </label>
          {!split ? (
            <label className="field">
              <span>{t("csv.amountCol")}</span>
              <input
                type="number"
                min={0}
                value={mapping.amountCol ?? 0}
                onChange={(event) => set("amountCol", Number(event.target.value))}
              />
            </label>
          ) : (
            <>
              <label className="field">
                <span>{t("csv.debitCol")}</span>
                <input
                  type="number"
                  min={0}
                  value={mapping.debitCol ?? 0}
                  onChange={(event) => set("debitCol", Number(event.target.value))}
                />
              </label>
              <label className="field">
                <span>{t("csv.creditCol")}</span>
                <input
                  type="number"
                  min={0}
                  value={mapping.creditCol ?? 0}
                  onChange={(event) => set("creditCol", Number(event.target.value))}
                />
              </label>
            </>
          )}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={mapping.hasHeader}
            onChange={(event) => set("hasHeader", event.target.checked)}
          />
          {t("csv.hasHeader")}
        </label>

        <button type="button" className="primary" onClick={() => void doImport()} disabled={busy || !path || accountId === 0}>
          {busy ? t("import.reading") : t("csv.import")}
        </button>
        {report ? <p className="muted">{report}</p> : null}
        {error ? (
          <div className="alert" role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <aside className="card">
        <header className="card-head">
          <h2>{t("csv.profiles")}</h2>
        </header>
        <label className="field">
          <span>{t("csv.profile")}</span>
          <select
            value={profileId ?? ""}
            onChange={(event) => applyProfile(event.target.value === "" ? null : Number(event.target.value))}
          >
            <option value="">{t("csv.noProfile")}</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <input
            value={profileName}
            maxLength={40}
            placeholder={t("csv.profileName")}
            onChange={(event) => setProfileName(event.target.value)}
            aria-label={t("csv.profileName")}
          />
          <button type="button" onClick={() => void saveProfile()} disabled={!profileName.trim()}>
            {t("common.save")}
          </button>
          {profileId !== null ? (
            <button type="button" className="ghost danger" onClick={() => void removeProfile()}>
              {t("common.delete")}
            </button>
          ) : null}
        </div>

        <header className="card-head">
          <h2>{t("csv.preview")}</h2>
          {preview ? (
            <span className="muted">{t("csv.previewLine", { rows: preview.rows.length, skipped: preview.issues.length })}</span>
          ) : null}
        </header>
        {previewError ? (
          <div className="alert" role="alert">
            {previewError}
          </div>
        ) : null}
        {preview && preview.rows.length > 0 ? (
          <ul className="history">
            {preview.rows.slice(0, 8).map((row) => (
              <li key={row.lineNo}>
                <span className="muted small">
                  {row.postedOn} · {t("csv.line", { line: row.lineNo })}
                </span>
                <span>{row.description || "—"}</span>
                <strong>{formatCents(row.amountCents)}</strong>
              </li>
            ))}
          </ul>
        ) : preview && path ? (
          <p className="muted">{t("csv.empty")}</p>
        ) : (
          <p className="muted">{t("csv.previewHint")}</p>
        )}
        {preview && preview.issues.length > 0 ? (
          <ul className="history">
            {preview.issues.slice(0, 5).map((issue) => (
              <li key={issue.lineNo}>
                <span className="muted small">{t("csv.line", { line: issue.lineNo })}</span>
                <span className="muted">{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>
    </div>
  );
}
