import type { UpdaterState } from "../lib/updater";

export function UpdateBanner({
  updater,
  onOpen,
}: {
  updater: UpdaterState;
  onOpen: () => void;
}) {
  const visible =
    updater.status === "available" ||
    updater.status === "downloading" ||
    updater.status === "ready";

  if (!visible) return null;

  const label =
    updater.status === "downloading"
      ? `downloading ${updater.progress >= 0 ? `${updater.progress}%` : "..."}`
      : updater.status === "ready"
        ? "restarting"
        : `version ${updater.version} available`;

  return (
    <button type="button" className="update-banner" onClick={onOpen}>
      {label}
    </button>
  );
}
