import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icons";
import type { Account } from "../lib/api";
import { useLanguage } from "../lib/language";

function AccountDialog({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: string;
  title: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(initial);
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() === "") return;
          onSave(name.trim());
        }}
      >
        <label className="field">
          <span>{t("accounts.name")}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <div className="dialog-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary">
            {t("common.save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Manual accounts live apart from bank statements: created by hand, renamed
 * freely and archived instead of deleted, so their history stays put.
 * Imported accounts are listed read-only for reference.
 */
export function AccountsManager({
  accounts,
  onCreate,
  onRename,
  onArchive,
}: {
  accounts: Account[];
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onArchive: (id: number) => void;
}) {
  const { t } = useLanguage();
  const manual = accounts.filter((account) => account.bankId === "" && account.acctId.startsWith("manual:"));
  const imported = accounts.filter((account) => !manual.includes(account));
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "rename"; id: number; name: string } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Account | null>(null);

  return (
    <article className="card">
      <header className="card-head">
        <div className="card-title">
          <h2>{t("accounts.title")}</h2>
        </div>
        <button type="button" className="round-button" onClick={() => setDialog({ mode: "create" })} aria-label={t("accounts.new")}>
          <Icon name="plus" size={16} />
        </button>
      </header>
      {manual.length === 0 ? (
        <p className="card-empty">{t("accounts.empty")}</p>
      ) : (
        <ul className="installment-list">
          {manual.map((account) => (
            <li key={account.id} className="installment">
              <div className="installment-head">
                <span className="installment-name">{account.name}</span>
                <span className="tx-actions">
                  <button
                    type="button"
                    className="icon-button"
                    title={t("accounts.rename")}
                    aria-label={`${t("accounts.rename")}: ${account.name}`}
                    onClick={() => setDialog({ mode: "rename", id: account.id, name: account.name })}
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title={t("accounts.archive")}
                    aria-label={`${t("accounts.archive")}: ${account.name}`}
                    onClick={() => setConfirmArchive(account)}
                  >
                    <Icon name="x" size={15} />
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {imported.length > 0 ? <p className="muted small">{t("accounts.importedNote", { count: imported.length })}</p> : null}

      {dialog ? (
        <AccountDialog
          initial={dialog.mode === "rename" ? dialog.name : ""}
          title={dialog.mode === "rename" ? t("accounts.renameTitle") : t("accounts.new")}
          onClose={() => setDialog(null)}
          onSave={(name) => {
            if (dialog.mode === "rename") onRename(dialog.id, name);
            else onCreate(name);
            setDialog(null);
          }}
        />
      ) : null}

      {confirmArchive ? (
        <Dialog title={t("accounts.confirmArchiveTitle", { name: confirmArchive.name })} onClose={() => setConfirmArchive(null)}>
          <p className="muted">{t("accounts.confirmArchiveDesc")}</p>
          <div className="dialog-actions">
            <button type="button" className="ghost" onClick={() => setConfirmArchive(null)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                onArchive(confirmArchive.id);
                setConfirmArchive(null);
              }}
            >
              {t("accounts.archive")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </article>
  );
}
