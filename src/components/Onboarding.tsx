import { BrushUnderline, Polaroid } from "./editorial";
import { useLanguage } from "../lib/language";

/**
 * First launch: no accounts yet. One dark surface, one sentence, three
 * polaroids for what comes next, and two ways forward.
 */
export function Onboarding({
  busy,
  onImport,
  onDemo,
  onDismiss,
}: {
  busy: boolean;
  onImport: () => void;
  onDemo: () => void;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const [before, after] = t("onboard.title", { word: "\u0000" }).split("\u0000");
  return (
    <section className="screen onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding-copy">
        <span className="eyebrow">{t("onboard.eyebrow")}</span>
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
          <button type="button" className="primary" onClick={onImport}>
            {t("onboard.import")}
          </button>
          <button type="button" className="outline-button" onClick={onDemo} disabled={busy}>
            {t("onboard.demo")}
          </button>
          <button type="button" className="ghost" onClick={onDismiss}>
            {t("onboard.dismiss")}
          </button>
        </div>
      </div>
      <div className="onboarding-photos">
        <Polaroid icon="bank" caption={t("onboard.cap1")} tilt={-3} />
        <Polaroid icon="chart-up" caption={t("onboard.cap2")} tilt={2} />
        <Polaroid icon="target" caption={t("onboard.cap3")} tilt={-1.5} />
      </div>
    </section>
  );
}
