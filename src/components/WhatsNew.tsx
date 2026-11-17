import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { notesFor } from "../lib/bundledNotes";
import { useLanguage } from "../lib/language";
import { Dialog } from "./Dialog";

const SEEN = "seen_version";

/** Shows the highlights of the version once, the first time the app opens after an update. */
export function WhatsNew({ version }: { version: string }) {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!version) return;
    let alive = true;
    api
      .getSetting(SEEN)
      .then((seen) => {
        if (!alive || seen === version) return;
        // A first install has no earlier version to compare with: nothing is "new" yet.
        if (seen !== null && notesFor(version, lang)) setOpen(true);
        else void api.setSetting(SEEN, version).catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [version, lang]);

  const notes = open ? notesFor(version, lang) : null;
  if (!open || !notes) return null;

  const close = () => {
    setOpen(false);
    void api.setSetting(SEEN, version).catch(() => {});
  };

  return (
    <Dialog title={t("whatsnew.title", { version })} onClose={close}>
      {notes.summary ? <p className="muted">{notes.summary}</p> : null}
      <ul className="whatsnew-list">
        {notes.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="primary" onClick={close}>
          {t("whatsnew.ok")}
        </button>
      </div>
    </Dialog>
  );
}
