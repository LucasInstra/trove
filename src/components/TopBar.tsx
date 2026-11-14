import { useState } from "react";
import type { PlanNotification } from "../domain/notifications";
import { monthName } from "../lib/format";
import { BrushUnderline } from "./editorial";
import { useLanguage } from "../lib/language";
import { MonthPicker } from "./MonthPicker";
import { Icon } from "./Icons";
import { setPrivate, usePrivacy } from "../lib/privacy";

interface TopBarProps {
  month: string;
  onMonth: (delta: number) => void;
  onPickMonth: (month: string) => void;
  notifications: PlanNotification[];
  onReadAll: () => void;
  onImport: () => void;
  onLaunch: () => void;
  canLaunch: boolean;
  primaryLabel: string;
  showLayout: boolean;
  layoutEditing: boolean;
  onToggleLayout: () => void;
}

export function TopBar({
  month,
  onMonth,
  onPickMonth,
  notifications,
  onReadAll,
  onImport,
  onLaunch,
  canLaunch,
  primaryLabel,
  showLayout,
  layoutEditing,
  onToggleLayout,
}: TopBarProps) {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const hidden = usePrivacy();
  return (
    <header className="topbar floating-bar">
      <div>
        <div className="title-row">
        <button
          type="button"
          className="icon-button"
          onClick={() => onMonth(-1)}
          aria-label={t("planner.previousMonth")}
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <h1>
          <BrushUnderline>{monthName(month, lang)}</BrushUnderline>
          <span className="title-year">{month.slice(0, 4)}</span>
        </h1>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMonth(1)}
          aria-label={t("planner.nextMonth")}
        >
          <Icon name="chevron-right" size={18} />
        </button>
        <MonthPicker month={month} onPick={onPickMonth} />
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => setPrivate(!hidden)}
          aria-label={t(hidden ? "privacy.show" : "privacy.hide")}
          aria-pressed={hidden}
          title={t(hidden ? "privacy.show" : "privacy.hide")}
        >
          <Icon name={hidden ? "eye-off" : "eye"} size={17} />
        </button>
        <div className="bell-wrap">
          <button
            type="button"
            className="icon-button bell"
            onClick={() => setOpen((value) => !value)}
            aria-label={t("notify.title")}
            aria-expanded={open}
          >
            <Icon name="bell" size={17} />
            {notifications.length > 0 ? <span className="bell-badge">{notifications.length}</span> : null}
          </button>
          {open ? (
            <div className="bell-panel" role="dialog" aria-label={t("notify.title")}>
              <header>
                <strong>{t("notify.title")}</strong>
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      onReadAll();
                      setOpen(false);
                    }}
                  >
                    {t("notify.markRead")}
                  </button>
                ) : null}
              </header>
              {notifications.length === 0 ? (
                <p className="muted small">{t("notify.empty")}</p>
              ) : (
                <ul>
                  {notifications.map((item) => (
                    <li key={item.key} className={item.kind}>
                      <span className={`dot notify-${item.kind}`} />
                      <span>{t(item.messageKey, item.vars)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        {showLayout ? (
          <button
            type="button"
            className={layoutEditing ? "icon-button layout-toggle active" : "icon-button layout-toggle"}
            aria-pressed={layoutEditing}
            title={t("layout.edit")}
            aria-label={t("layout.edit")}
            onClick={onToggleLayout}
          >
            <Icon name="layout" size={17} />
          </button>
        ) : null}
        <button type="button" className="outline-button" onClick={onImport}>
          <Icon name="arrow-down-to-line" size={16} />
          {primaryLabel}
        </button>
        <button
          type="button"
          className="primary topbar-primary"
          onClick={onLaunch}
          disabled={!canLaunch}
          title={canLaunch ? undefined : t("manual.needsAccount")}
        >
          <Icon name="plus" size={16} />
          {t("manual.launch")}
        </button>
      </div>
    </header>
  );
}
