import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import { monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";

/** A calendar button that opens a year and twelve months, instead of the system picker. */
export function MonthPicker({
  month,
  onPick,
}: {
  month: string;
  onPick: (month: string) => void;
}) {
  const { lang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setYear(Number(month.slice(0, 4)));
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
  }, [open, month]);

  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="month-pop" ref={root}>
      <button
        type="button"
        className="icon-button"
        title={t("planner.pickMonth")}
        aria-label={t("planner.pickMonth")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="calendar" size={16} />
      </button>
      {open ? (
        <div className="month-pop-panel" role="dialog" aria-label={t("planner.pickMonth")}>
          <div className="month-pop-year">
            <button
              type="button"
              className="icon-button"
              aria-label={t("planner.previousMonth")}
              onClick={() => setYear((value) => value - 1)}
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <strong>{year}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label={t("planner.nextMonth")}
              onClick={() => setYear((value) => value + 1)}
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
          <div className="month-pop-grid">
            {Array.from({ length: 12 }, (_, index) => {
              const value = `${year}-${String(index + 1).padStart(2, "0")}`;
              return (
                <button
                  key={value}
                  type="button"
                  className={
                    value === month ? "is-selected" : value === thisMonth ? "is-today" : undefined
                  }
                  aria-pressed={value === month}
                  onClick={() => {
                    onPick(value);
                    setOpen(false);
                  }}
                >
                  {monthShort(value, lang)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
