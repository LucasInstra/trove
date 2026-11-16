import { useEffect, useState } from "react";
import { DEFAULT_RATES, type RateAssumptions } from "../domain/patrimony";
import { api } from "../lib/api";
import { useLanguage } from "../lib/language";

/** Fired after a rate is saved, so the sheets that show estimates reload it. */
export const RATES_CHANGED = "trove:rates-changed";

/** The yearly CDI and IPCA the investment estimates use, kept in the settings. */
export function InvestmentRates() {
  const { t } = useLanguage();
  const [rates, setRates] = useState<RateAssumptions>(DEFAULT_RATES);

  useEffect(() => {
    let alive = true;
    void Promise.all([api.getSetting("rate_cdi"), api.getSetting("rate_ipca")])
      .then(([cdi, ipca]) => {
        if (!alive) return;
        setRates({
          cdiPct: Number(cdi) > 0 ? Number(cdi) : DEFAULT_RATES.cdiPct,
          ipcaPct: Number(ipca) > 0 ? Number(ipca) : DEFAULT_RATES.ipcaPct,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const save = (key: "cdiPct" | "ipcaPct", raw: string) => {
    const value = Number(raw.replace(",", "."));
    if (!(value > 0 && value < 100)) return;
    setRates((current) => ({ ...current, [key]: value }));
    void api
      .setSetting(key === "cdiPct" ? "rate_cdi" : "rate_ipca", String(value))
      .then(() => window.dispatchEvent(new Event(RATES_CHANGED)))
      .catch(() => undefined);
  };

  return (
    <div className="dialog-form">
      <p className="muted">{t("investments.assumptionsHint")}</p>
      <div className="form-grid">
        <label className="field">
          <span>{t("investments.cdiYear")}</span>
          <span className="input-affix">
            <input
              key={`cdi-${rates.cdiPct}`}
              defaultValue={String(rates.cdiPct).replace(".", ",")}
              inputMode="decimal"
              onBlur={(event) => save("cdiPct", event.target.value)}
            />
            <span>%</span>
          </span>
        </label>
        <label className="field">
          <span>{t("investments.ipcaYear")}</span>
          <span className="input-affix">
            <input
              key={`ipca-${rates.ipcaPct}`}
              defaultValue={String(rates.ipcaPct).replace(".", ",")}
              inputMode="decimal"
              onBlur={(event) => save("ipcaPct", event.target.value)}
            />
            <span>%</span>
          </span>
        </label>
      </div>
    </div>
  );
}
