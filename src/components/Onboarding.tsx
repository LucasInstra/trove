import { useState } from "react";
import { BrushUnderline, Polaroid } from "./editorial";
import { parseCents } from "./PlannerDialogs";
import { useLanguage } from "../lib/language";
import type { Lang } from "../lib/i18n";

type Step = "welcome" | "name" | "income" | "ready";
const ORDER: Step[] = ["welcome", "name", "income", "ready"];

/**
 * First launch: no accounts yet. A short guided start: welcome, your name and
 * language, your monthly income, and how to bring the first entries in. Every
 * step after the welcome can be skipped.
 */
export function Onboarding({
  busy,
  onSaveName,
  onSaveIncome,
  onImport,
  onManual,
  onDemo,
  onDismiss,
}: {
  busy: boolean;
  onSaveName: (name: string) => void;
  onSaveIncome: (amountCents: number, payDay: number) => Promise<void>;
  onImport: () => void;
  onManual: () => void;
  onDemo: () => void;
  onDismiss: () => void;
}) {
  const { lang, setLang, t } = useLanguage();
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [payDay, setPayDay] = useState("5");
  const [saving, setSaving] = useState(false);
  const [before, after] = t("onboard.title", { word: "\u0000" }).split("\u0000");
  const index = ORDER.indexOf(step);
  const next = () => setStep(ORDER[Math.min(index + 1, ORDER.length - 1)]);

  const saveName = () => {
    if (name.trim()) onSaveName(name.trim());
    next();
  };

  const saveIncome = async () => {
    const cents = parseCents(amount);
    const day = Math.min(31, Math.max(1, Number.parseInt(payDay, 10) || 1));
    if (cents > 0) {
      setSaving(true);
      try {
        await onSaveIncome(cents, day);
      } finally {
        setSaving(false);
      }
    }
    next();
  };

  return (
    <section className="screen onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding-copy">
        <span className="eyebrow">
          {t("onboard.eyebrow")}
          {step === "welcome" ? "" : ` · ${t("onboard.stepOf", { n: index, total: ORDER.length - 1 })}`}
        </span>

        {step === "welcome" ? (
          <>
            <h1 id="onboarding-title">
              {before}
              <BrushUnderline>{t("onboard.word")}</BrushUnderline>
              {after}
            </h1>
            <p>{t("onboard.desc")}</p>
            <ol className="onboarding-steps">
              <li>{t("onboard.step1")}</li>
              <li>{t("onboard.step2")}</li>
              <li>{t("onboard.step3")}</li>
            </ol>
            <div className="onboarding-actions">
              <button type="button" className="primary" onClick={next}>
                {t("onboard.start")}
              </button>
              <button type="button" className="ghost" onClick={onDismiss}>
                {t("onboard.dismiss")}
              </button>
            </div>
          </>
        ) : null}

        {step === "name" ? (
          <>
            <h1 id="onboarding-title">{t("onboard.nameTitle")}</h1>
            <p>{t("onboard.nameDesc")}</p>
            <label className="field">
              <span>{t("onboard.nameLabel")}</span>
              <input
                value={name}
                autoFocus
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveName();
                }}
              />
            </label>
            <div className="field">
              <span>{t("onboard.language")}</span>
              <div className="segmented" role="group" aria-label={t("onboard.language")}>
                {(["pt", "en"] as Lang[]).map((option) => (
                  <button key={option} type="button" aria-pressed={lang === option} onClick={() => setLang(option)}>
                    {option === "pt" ? "Português" : "English"}
                  </button>
                ))}
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="primary" onClick={saveName}>
                {t("onboard.next")}
              </button>
              <button type="button" className="ghost" onClick={next}>
                {t("onboard.skip")}
              </button>
            </div>
          </>
        ) : null}

        {step === "income" ? (
          <>
            <h1 id="onboarding-title">{t("onboard.incomeTitle")}</h1>
            <p>{t("onboard.incomeDesc")}</p>
            <label className="field">
              <span>{t("onboard.incomeLabel")}</span>
              <input
                inputMode="decimal"
                value={amount}
                autoFocus
                placeholder="0,00"
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("onboard.payDay")}</span>
              <input inputMode="numeric" value={payDay} maxLength={2} onChange={(event) => setPayDay(event.target.value)} />
            </label>
            <div className="onboarding-actions">
              <button type="button" className="primary" disabled={saving} onClick={() => void saveIncome()}>
                {t("onboard.next")}
              </button>
              <button type="button" className="ghost" onClick={next}>
                {t("onboard.skip")}
              </button>
            </div>
          </>
        ) : null}

        {step === "ready" ? (
          <>
            <h1 id="onboarding-title">{t("onboard.readyTitle")}</h1>
            <p>{t("onboard.readyDesc")}</p>
            <div className="onboarding-actions">
              <button type="button" className="primary" onClick={onManual}>
                {t("onboard.manual")}
              </button>
              <button type="button" className="ghost" onClick={onImport}>
                {t("onboard.import")}
              </button>
            </div>
            <button type="button" className="onboarding-demo" onClick={onDemo} disabled={busy}>
              {t("onboard.demo")}
            </button>
            <button type="button" className="onboarding-demo" onClick={onDismiss}>
              {t("onboard.finish")}
            </button>
          </>
        ) : null}
      </div>
      <div className="onboarding-photos">
        <Polaroid icon="bank" caption={t("onboard.cap1")} tilt={-3} />
        <Polaroid icon="pie" caption={t("onboard.cap2")} tilt={2} />
        <Polaroid icon="target" caption={t("onboard.cap3")} tilt={-1.5} />
      </div>
    </section>
  );
}
