import { useEffect, useState } from "react";
import { CRYPTO_EVENT, CRYPTO_SETTING } from "../domain/crypto";
import { api } from "../lib/api";
import { useLanguage } from "../lib/language";
import { Dialog } from "./Dialog";

/** Saves the choice and tells the rest of the app. */
export async function chooseCrypto(on: boolean) {
  await api.setSetting(CRYPTO_SETTING, on ? "on" : "off");
  window.dispatchEvent(new Event(CRYPTO_EVENT));
}

/** What the feature does and what it costs in privacy, shown in the prompt and in Settings. */
function Explanation() {
  const { t } = useLanguage();
  return (
    <>
      <p>{t("crypto.what")}</p>
      <p className="muted small">{t("crypto.privacy")}</p>
    </>
  );
}

/**
 * Asked once, at the first use (after the onboarding) and again for someone who
 * updates from a version that had no crypto: nothing is fetched until they say yes.
 */
export function CryptoPrompt() {
  const { t } = useLanguage();
  const answer = (on: boolean) => {
    void chooseCrypto(on).catch(() => {});
  };
  return (
    <Dialog title={t("crypto.promptTitle")} onClose={() => answer(false)} required>
      <Explanation />
      <div className="dialog-actions">
        <button type="button" onClick={() => answer(false)}>
          {t("crypto.notNow")}
        </button>
        <button type="button" className="primary" onClick={() => answer(true)}>
          {t("crypto.enable")}
        </button>
      </div>
    </Dialog>
  );
}

/** Settings card to turn crypto prices on or off, and to refresh them now. */
export function CryptoCard() {
  const { t } = useLanguage();
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const read = () => {
      api
        .getSetting(CRYPTO_SETTING)
        .then(setValue)
        .catch(() => {});
    };
    read();
    window.addEventListener(CRYPTO_EVENT, read);
    return () => window.removeEventListener(CRYPTO_EVENT, read);
  }, []);

  const on = value === "on";
  const refresh = async () => {
    setConfirming(false);
    setBusy(true);
    setMessage("");
    try {
      const count = await api.refreshCryptoPrices();
      setMessage(t("crypto.updated", { count: String(count) }));
      window.dispatchEvent(new Event(CRYPTO_EVENT));
    } catch (problem) {
      setMessage(t("crypto.failed", { reason: problem instanceof Error ? problem.message : String(problem) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card" id="crypto-card">
      <header className="card-head">
        <h2>{t("crypto.title")}</h2>
      </header>
      <Explanation />
      <div className="segmented wide">
        <button type="button" className={on ? "active" : ""} aria-pressed={on} onClick={() => void chooseCrypto(true)}>
          {t("crypto.on")}
        </button>
        <button type="button" className={!on ? "active" : ""} aria-pressed={!on} onClick={() => void chooseCrypto(false)}>
          {t("crypto.off")}
        </button>
      </div>
      {on ? (
        <p>
          {confirming ? (
            <>
              <span className="small">{t("crypto.confirmRefresh")}</span>{" "}
              <button type="button" className="primary" disabled={busy} onClick={() => void refresh()}>
                {t("crypto.confirmYes")}
              </button>{" "}
              <button type="button" className="ghost" onClick={() => setConfirming(false)}>
                {t("crypto.confirmNo")}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirming(true)}>
              {t("crypto.refresh")}
            </button>
          )}{" "}
          <span className="muted small" role="status">
            {message}
          </span>
        </p>
      ) : null}
    </article>
  );
}
