import { useState } from "react";
import type { PlanNotification } from "../domain/notifications";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

interface TopBarProps {
  month: string;
  title: string;
  onMonth: (delta: number) => void;
  onPickMonth: (month: string) => void;
  notifications: PlanNotification[];
  onReadAll: () => void;
  onImport: () => void;
  primaryLabel: string;
}

export function TopBar({
  month,
  title,
  onMonth,
  onPickMonth,
  notifications,
  onReadAll,
  onImport,
  primaryLabel,
}: TopBarProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="title-row">
        <button type="button" className="icon-button" onClick={() => onMonth(-1)} aria-label="Previous month">
          <Icon name="left" size={16} />
        </button>
        <h1>{title}</h1>
        <button type="button" className="icon-button" onClick={() => onMonth(1)} aria-label="Next month">
          <Icon name="right" size={16} />
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
        <button type="button" className="primary" onClick={onImport}>
          <Icon name="plus" size={15} />
          {primaryLabel}
        </button>
      </div>
    </header>
  );
}
