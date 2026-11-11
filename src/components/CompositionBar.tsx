import type { Composition } from "../domain/projection";
import { useLanguage } from "../lib/language";

const LABELS: Record<Composition["key"], string> = {
  housing: "composition.housing",
  bills: "composition.bills",
  spent: "composition.spent",
  free: "composition.free",
};

const READS_CENTS = new Set<Composition["key"]>(["housing", "bills", "spent"]);

interface Props {
  parts: Composition[];
  format: (cents: number) => string;
}

/** Income in, commitments and what is left, in one track with its legend. */
export function CompositionBar({ parts, format }: Props) {
  const { t } = useLanguage();
  if (parts.length === 0) return null;
  return (
    <div className="composition">
      <div className="composition-track">
        {parts.map((part) => (
          <span
            key={part.key}
            className={`composition-part ${part.key}`}
            style={{ flexGrow: Math.max(0.001, part.sharePct) }}
            title={`${t(LABELS[part.key])}: ${format(part.amountCents)}`}
          />
        ))}
      </div>
      <ul className="composition-legend">
        {parts.map((part) => (
          <li key={part.key}>
            <span className="composition-item">
              <span className={`dot composition-dot ${part.key}`} />
              {t(LABELS[part.key])}
            </span>
            <span className="composition-value">
              {READS_CENTS.has(part.key) ? "−" : ""}
              {format(part.amountCents)}
              <em>{Math.round(part.sharePct)}%</em>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
