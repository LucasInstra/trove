import { useLanguage } from "../lib/language";
import type { UpdaterState } from "../lib/updater";

export function UpdateBanner({ updater, onOpen }: { updater: UpdaterState; onOpen: () => void }) {
  const { t } = useLanguage();

  const visible =
    updater.status === "available" ||
    updater.status === "downloading" ||
    updater.status === "ready";

  if (!visible) return null;

  const label =
    updater.status === "downloading"
      ? updater.progress >= 0
        ? t("update.downloading", { percent: updater.progress })
        : t("update.downloadingPlain")
      : updater.status === "ready"
        ? t("update.restarting")
        : t("update.available", { version: updater.version });

  return (
    <button type="button" className="update-banner" onClick={onOpen}>
      {label}
    </button>
  );
}
