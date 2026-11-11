import { useState } from "react";
import type { PlanNotification } from "../domain/notifications";
import { monthName } from "../lib/format";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

interface TopBarProps {
  month: string;
  onMonth: (delta: number) => void;
  onPickMonth: (month: string) => void;
  notifications: PlanNotification[];
  onReadAll: () => void;
  onImport: () => void;
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
  primaryLabel,
  showLayout,
  layoutEditing,
  onToggleLayout,
}: TopBarProps) {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="title-row">
        <button type="button" className="icon-button" onClick={() => onMonth(-1)} aria-label="Previous month">
          <Icon name="chevron-left" size={18} />
        </button>
        <h1>
          {monthName(month, lang)}
          <span className="title-year">{month.slice(0, 4)}</span>
        </h1>
        <button type="button" className="icon-button" onClick={() => onMonth(1)} aria-label="Next month">
          <Icon name="chevron-right" size={18} />
        </button>
        <label className="month-picker" title={t("planner.pickMonth")}>
          <span className="visually-hidden">{t("planner.pickMonth")}</span>
          <input
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) onPickMonth(event.target.value);
            }}
            aria-label={t("planner.pickMonth")}
          />
          <Icon name="calendar" size={15} />
        </label>
      </div>

      <div className="topbar-actions">
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
        <button type="button" className="primary topbar-primary" onClick={onImport}>
          <Icon name="arrow-down-to-line" size={16} />
          {primaryLabel}
        </button>
      </div>
    </header>
  );
}
