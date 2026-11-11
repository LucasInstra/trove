import { useEffect, useRef, useState } from "react";
import { connectorPath, connectorPoints, dotLevels } from "../domain/connector";
import { formatCents, monthShort } from "../lib/format";
import { useLanguage } from "../lib/language";

interface Props {
  months: string[];
  values: number[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Three month tiles joined by a dashed line. The dot sits higher when that
 * month's invoice is bigger, which is the whole point of the chart.
 */
export function UpcomingInvoices({ months, values, activeIndex, onSelect }: Props) {
  const { lang, t } = useLanguage();
  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;
    const update = () => setWidth(node.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const points = connectorPoints(dotLevels(values), width, 12, 24);

  return (
    <div className="upcoming">
      <span className="upcoming-label">{t("planner.upcoming")}</span>
      <div className="upcoming-row" ref={rowRef}>
        {width > 0 ? (
          <svg className="upcoming-line" width={width} height={44} aria-hidden="true">
            <path
              d={connectorPath(points)}
              fill="none"
              stroke="var(--line-strong)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {points.map((point, index) => (
              <circle
                key={months[index]}
                cx={point.x}
                cy={point.y}
                r={5}
                fill="var(--surface-soft)"
                stroke={index === activeIndex ? "var(--primary)" : "var(--line-strong)"}
                strokeWidth="1.5"
              />
            ))}
          </svg>
        ) : null}

        {months.map((month, index) => (
          <button
            key={month}
            type="button"
            className={index === activeIndex ? "upcoming-tile active" : "upcoming-tile"}
            onClick={() => onSelect(index)}
            aria-pressed={index === activeIndex}
          >
            <span className="upcoming-month">
              {monthShort(month, lang)}
              {index === 0 ? <em className="upcoming-badge">{t("planner.open")}</em> : null}
            </span>
            <span className="upcoming-value">
              {values[index] > 0 ? formatCents(values[index]) : "—"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
