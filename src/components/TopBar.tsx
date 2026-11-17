import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { PlanNotification } from "../domain/notifications";
import type { Account } from "../lib/api";
import { monthName } from "../lib/format";
import { BrushUnderline } from "./editorial";
import { useLanguage } from "../lib/language";
import { MonthPicker } from "./MonthPicker";
import { DayPicker } from "./DayPicker";
import { Icon } from "./Icons";
import { Icon3DSet } from "./Icon3DSet";

/** The picture beside each kind of alert: overdue, due soon, card closing, setup. */
const NOTIFY_ART: Record<PlanNotification["kind"], string> = {
  late: "state-warning",
  soon: "state-due-soon",
  card: "state-due-soon",
  setup: "state-info",
};
import { setPrivate, usePrivacy } from "../lib/privacy";

interface TopBarProps {
  month: string;
  onMonth: (delta: number) => void;
  onPickMonth: (month: string) => void;
  notifications: PlanNotification[];
  onReadAll: () => void;
  onImport: () => void;
  onLaunch: () => void;
  primaryLabel: string;
  showLayout: boolean;
  layoutEditing: boolean;
  onToggleLayout: () => void;
  /** The day of the month shown left of the month, and the day today is when it is the current month. */
  day: number;
  todayDay: number | null;
  onPickDay: (day: number) => void;
  accounts: Account[];
  accountFilter: number | null;
  onAccountFilter: (accountId: number | null) => void;
}

export function TopBar({
  month,
  onMonth,
  onPickMonth,
  notifications,
  onReadAll,
  onImport,
  onLaunch,
  primaryLabel,
  showLayout,
  layoutEditing,
  onToggleLayout,
  day,
  todayDay,
  onPickDay,
  accounts,
  accountFilter,
  onAccountFilter,
}: TopBarProps) {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const hidden = usePrivacy();

  // Changing the month: the title slides in from the side the month came from and the
  // page fades up, so the change reads as movement. Skipped on first render and for reduced motion.
  const previousMonth = useRef(month);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  useEffect(() => {
    if (previousMonth.current === month) return;
    setDirection(month > previousMonth.current ? "next" : "prev");
    previousMonth.current = month;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelector<HTMLElement>("main .screen")?.animate(
      [
        { opacity: 0.35, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, [month]);

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
        <h1 key={month} className={`month-title month-${direction}`}>
          <DayPicker month={month} day={day} today={todayDay} onPick={onPickDay} />
          <MonthPicker month={month} onPick={onPickMonth}>
            <BrushUnderline>{monthName(month, lang)}</BrushUnderline>
            <span className="title-year">{month.slice(0, 4)}</span>
          </MonthPicker>
        </h1>
        <button
          type="button"
          className="icon-button"
          onClick={() => onMonth(1)}
          aria-label={t("planner.nextMonth")}
        >
          <Icon name="chevron-right" size={18} />
        </button>
        <div id="topbar-slot" className="topbar-slot" />
        </div>
      </div>

      <div className="topbar-actions">
        <div id="topbar-extra" className="topbar-extra" />
        {accounts.length > 1 ? (
          <label className="topbar-account" title={t("accounts.scopeHint")}>
            <span className="visually-hidden">{t("ledger.account")}</span>
            <select
              value={accountFilter ?? ""}
              onChange={(event) => onAccountFilter(event.target.value === "" ? null : Number(event.target.value))}
            >
              <option value="">{t("ledger.allAccounts")}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            const next = !hidden;
            // The figures dissolve into the dots (and back): a window cross-fade, where supported.
            if (
              typeof document.startViewTransition === "function" &&
              !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ) {
              document.documentElement.classList.add("vt-privacy");
              const transition = document.startViewTransition(() => flushSync(() => setPrivate(next)));
              void transition.finished.finally(() => document.documentElement.classList.remove("vt-privacy"));
            } else {
              setPrivate(next);
            }
          }}
          aria-label={t(hidden ? "privacy.show" : "privacy.hide")}
          aria-pressed={hidden}
          title={t(hidden ? "privacy.show" : "privacy.hide")}
        >
          <span key={hidden ? "off" : "on"} className="eye-swap">
            <Icon name={hidden ? "eye-off" : "eye"} size={17} />
          </span>
        </button>
        <div className="bell-wrap">
          <button
            type="button"
            className={open ? "icon-button bell ringing" : "icon-button bell"}
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
                      <Icon3DSet name={NOTIFY_ART[item.kind]} size={28} className="notify-art" />
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
        <button type="button" className="outline-button import-button" onClick={onImport} title={primaryLabel} aria-label={primaryLabel}>
          <Icon name="arrow-down-to-line" size={16} />
          <span className="import-label">{primaryLabel}</span>
        </button>
        <button
          type="button"
          className="primary topbar-primary"
          onClick={onLaunch}
        >
          <Icon name="plus" size={16} />
          {t("manual.launch")}
        </button>
      </div>
    </header>
  );
}
