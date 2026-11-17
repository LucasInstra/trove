import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/language";

/** The number of the day, left of the month: it picks a day of the month on screen, nothing else. */
export function DayPicker({
  month,
  day,
  today,
  onPick,
}: {
  month: string;
  day: number;
  /** The day of the month that is today, when the month on screen is the current one. */
  today: number | null;
  onPick: (day: number) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const length = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <span className="month-pop title" ref={root}>
      <button
        type="button"
        className="title-button title-day"
        title={t("topbar.pickDay")}
        aria-label={t("topbar.pickDay")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {day}
      </button>
      {open ? (
        <div className="month-pop-panel" role="dialog" aria-label={t("topbar.pickDay")}>
          <div className="month-pop-grid day-pop-grid">
            {Array.from({ length }, (_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  type="button"
                  className={value === day ? "is-selected" : value === today ? "is-today" : undefined}
                  aria-pressed={value === day}
                  onClick={() => {
                    onPick(value);
                    setOpen(false);
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </span>
  );
}
