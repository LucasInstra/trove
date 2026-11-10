import type { Composition } from "../domain/projection";

const LABELS: Record<Composition["key"], [string, string]> = {
  bills: ["Contas do mês", "Bills this month"],
  spent: ["Saídas", "Spent"],
  free: ["Sobra prevista", "Forecast left"],
};

interface Props {
  parts: Composition[];
  lang: "en" | "pt";
  format: (cents: number) => string;
}

/** Income in, commitments and what is left, in one track. */
export function CompositionBar({ parts, lang, format }: Props) {
  if (parts.length === 0) return null;
  return (
    <div className="composition">
      <div className="composition-track">
        {parts.map((part) => (
          <span
            key={part.key}
            className={`composition-part ${part.key}`}
            style={{ flexGrow: Math.max(0.001, part.sharePct) }}
            title={`${LABELS[part.key][lang === "pt" ? 0 : 1]}: ${format(part.amountCents)}`}
          />
        ))}
      </div>
      <ul className="composition-legend">
        {parts.map((part) => (
          <li key={part.key}>
            <span className={`dot composition-dot ${part.key}`} />
            <span>{LABELS[part.key][lang === "pt" ? 0 : 1]}</span>
            <strong>{format(part.amountCents)}</strong>
            <span className="muted">{Math.round(part.sharePct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
