import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
import { api, type ImportRow, type TransactionRow } from "../lib/api";
import { fileName, formatDateTime } from "../lib/format";
import { useLanguage } from "../lib/language";

/** Where a set of entries came from: a file, a CSV, or typed by hand. */
interface Origin {
  key: string;
  kind: "manual" | "ofx" | "csv";
  file: string;
  count: number;
  accounts: string[];
}

function originsOf(rows: TransactionRow[]): Origin[] {
  const found = new Map<string, Origin>();
  for (const row of rows) {
    const manual = row.origin === "manual" || row.source === "manual";
    const key = manual ? "manual" : row.source || row.origin;
    const entry = found.get(key) ?? {
      key,
      kind: manual ? "manual" : row.origin === "csv" ? "csv" : "ofx",
      file: manual ? "" : row.source,
      count: 0,
      accounts: [],
    };
    entry.count += 1;
    if (!entry.accounts.includes(row.accountName)) entry.accounts.push(row.accountName);
    found.set(key, entry);
  }
  return [...found.values()].sort((left, right) => right.count - left.count);
}

/**
 * A number answers for itself: which files and which hand-typed entries are
 * behind it. Pass the entries, or a month and the dialog fetches them.
 */
export function Provenance({
  rows,
  month,
  onClose,
}: {
  rows?: TransactionRow[];
  month?: string;
  onClose: () => void;
}) {
  const { lang, t } = useLanguage();
  const [loaded, setLoaded] = useState<TransactionRow[] | null>(rows ?? null);
  const [imports, setImports] = useState<ImportRow[]>([]);

  useEffect(() => {
    if (rows || !month) return;
    api
      .transactions("", month, null, 5000, null)
      .then((all) => setLoaded(all.filter((row) => row.transferGroup == null)))
      .catch(() => setLoaded([]));
  }, [rows, month]);

  useEffect(() => {
    api
      .imports(200)
      .then(setImports)
      .catch(() => setImports([]));
  }, []);

  const entries = loaded ?? [];
  const origins = originsOf(entries);
  const single = entries.length === 1 ? entries[0] : null;
  const importedAt = (file: string) =>
    imports.find((row) => row.path === file)?.importedAt ?? null;

  const kindLabel = (kind: Origin["kind"]) =>
    kind === "manual" ? t("prov.manual") : kind === "csv" ? t("prov.fromCsv") : t("prov.fromOfx");

  return (
    <Dialog title={t("prov.title")} onClose={onClose}>
      {loaded === null ? <p className="muted">{t("common.loading")}</p> : null}

      {single ? (
        <dl className="prov-facts">
          <div>
            <dt>{kindLabel(origins[0]?.kind ?? "ofx")}</dt>
            <dd>{single.merchant || single.description}</dd>
          </div>
          {origins[0]?.kind !== "manual" ? (
            <>
              <div>
                <dt>{t("prov.file")}</dt>
                <dd title={single.source}>{fileName(single.source)}</dd>
              </div>
              <div>
                <dt>{t("prov.imported")}</dt>
                <dd>
                  {importedAt(single.source)
                    ? formatDateTime(importedAt(single.source) as string, lang)
                    : t("prov.notInHistory")}
                </dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>{t("prov.account")}</dt>
            <dd>{single.accountName}</dd>
          </div>
        </dl>
      ) : null}

      {!single && loaded !== null ? (
        <>
          <p className="muted">{t("prov.summary", { count: entries.length })}</p>
          <ul className="prov-list">
            {origins.map((origin) => (
              <li key={origin.key}>
                <span className="prov-icon" aria-hidden="true">
                  <Icon name={origin.kind === "manual" ? "pencil" : "file"} size={15} />
                </span>
                <div className="prov-main">
                  <strong title={origin.file}>
                    {origin.kind === "manual" ? t("prov.manual") : fileName(origin.file)}
                  </strong>
                  <span className="muted small">
                    {origin.kind === "manual"
                      ? origin.accounts.join(", ")
                      : [
                          origin.accounts.join(", "),
                          importedAt(origin.file)
                            ? `${t("prov.imported")} ${formatDateTime(importedAt(origin.file) as string, lang)}`
                            : t("prov.notInHistory"),
                        ].join(" · ")}
                  </span>
                </div>
                <span className="prov-count">{t("prov.entriesFrom", { count: origin.count })}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {loaded !== null && origins.some((origin) => origin.kind !== "manual") ? (
        <p className="muted small">{t("prov.noLine")}</p>
      ) : null}
    </Dialog>
  );
}
