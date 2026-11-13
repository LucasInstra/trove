import type { Composition } from "../domain/projection";
import { useLanguage } from "../lib/language";

const LABELS: Record<Composition["key"], string> = {
  personal: "composition.personal",
  housing: "composition.housing",
  reserved: "composition.reserved",
  receivable: "composition.receivable",
  free: "composition.free",
};

const SIGNS: Record<Composition["key"], string> = {
  personal: "−",
  housing: "−",
  reserved: "−",
  receivable: "+",
  free: "",
};

interface Props {
  parts: Composition[];
  format: (cents: number) => string;
}

/** Income in, commitments and what is left, in one track with its legend. */
export function CompositionBar({ parts, format }: Props) {
  const { t } = useLanguage();
  if (parts.length === 0) return null;
  // Slivers under 5% are unreadable in the legend, so they share one line.
  const small = parts.filter((part) => part.key !== "free" && part.sharePct < 5);
  const legend = small.length > 1 ? parts.filter((part) => !small.includes(part)) : parts;
  const otherCents = small.reduce((sum, part) => sum + (SIGNS[part.key] === "+" ? part.amountCents : -part.amountCents), 0);
  const otherShare = small.reduce((sum, part) => sum + part.sharePct, 0);
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
        {legend.map((part) => (
          <li key={part.key}>
            <span className="composition-item">
              <span className={`dot composition-dot ${part.key}`} />
              {t(LABELS[part.key])}
            </span>
            <span className="composition-value">
              {SIGNS[part.key]}
              {format(part.amountCents)}
              <em>{Math.round(part.sharePct)}%</em>
            </span>
          </li>
        ))}
        {small.length > 1 ? (
          <li key="other">
            <span className="composition-item">
              <span className="dot composition-dot reserved" />
              {t("overview.compositionOther")}
            </span>
            <span className="composition-value">
              {otherCents < 0 ? "−" : "+"}
              {format(Math.abs(otherCents))}
              <em>{Math.round(otherShare)}%</em>
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
