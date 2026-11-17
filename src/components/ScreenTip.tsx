import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

const SETTING = "tips_seen";
export const TIPS_EVENT = "trove:tips";

function parse(value: string | null): string[] {
  try {
    const parsed = value ? (JSON.parse(value) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Forgets every dismissed tip, so each screen explains itself again. */
export async function resetTips() {
  await api.setSetting(SETTING, "[]");
  window.dispatchEvent(new Event(TIPS_EVENT));
}

/**
 * A short explanation at the top of a screen. "Got it" hides it for good, and
 * redoing the introduction in Settings brings every tip back.
 */
export function ScreenTip({ route }: { route: string }) {
  const { t } = useLanguage();
  const [seen, setSeen] = useState<string[] | null>(null);

  useEffect(() => {
    const read = () => {
      api
        .getSetting(SETTING)
        .then((value) => setSeen(parse(value)))
        .catch(() => setSeen([]));
    };
    read();
    window.addEventListener(TIPS_EVENT, read);
    return () => window.removeEventListener(TIPS_EVENT, read);
  }, []);

  const dismiss = useCallback(() => {
    const next = [...(seen ?? []), route];
    setSeen(next);
    void api.setSetting(SETTING, JSON.stringify(next)).catch(() => {});
  }, [seen, route]);

  if (seen === null || seen.includes(route)) return null;
  return (
    <aside className="screen-tip" role="note">
      <Icon name="info" size={18} />
      <p>{t(`tip.${route}`)}</p>
      <button type="button" className="outline-button" onClick={dismiss}>
        {t("tip.gotIt")}
      </button>
    </aside>
  );
}
