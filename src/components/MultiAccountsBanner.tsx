import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

/** Offered once on the main screens to someone who keeps a single account. */
export function MultiAccountsBanner({ onUse, onLater }: { onUse: () => void; onLater: () => void }) {
  const { t } = useLanguage();
  return (
    <aside className="screen-tip multi-banner" role="note">
      <Icon name="bank" size={18} />
      <p>
        <strong>{t("accounts.bannerTitle")}</strong> {t("accounts.bannerDesc")}
      </p>
      <button type="button" className="primary" onClick={onUse}>
        {t("accounts.multiUse")}
      </button>
      <button type="button" className="ghost" onClick={onLater}>
        {t("accounts.bannerLater")}
      </button>
    </aside>
  );
}
