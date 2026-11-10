import { formatCents } from "../lib/format";

interface MoneyProps {
  cents: number;
  className?: string;
}

/**
 * The headline number of the reference: the integer part large, the cents
 * smaller and muted, so the eye lands on the magnitude first.
 */
export function Money({ cents, className }: MoneyProps) {
  const value = formatCents(Math.abs(cents));
  const cut = value.lastIndexOf(",");
  const withCents = cut > 0 ? value.slice(0, cut) : value;
  const rest = cut > 0 ? value.slice(cut) : "";
  // Intl puts a non-breaking space after the currency, so match any space.
  const match = withCents.match(/^(.*?)[\s\u00a0]+([\d.]+)$/);
  const prefix = match ? match[1] : "";
  const whole = match ? match[2] : withCents;
  const sign = cents < 0 ? "-" : "";
  return (
    <span className={className ? `money ${className}` : "money"}>
      {sign}
      {prefix ? <span className="money-prefix">{prefix.trim()}</span> : null}
      {whole}
      <span className="money-cents">{rest}</span>
    </span>
  );
}
