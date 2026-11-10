import { formatCents } from "../lib/format";

interface MoneyProps {
  cents: number;
  signed?: boolean;
  className?: string;
}

/**
 * The headline number of the reference: the integer part large, the cents
 * smaller and muted, so the eye lands on the magnitude first.
 */
export function Money({ cents, signed = false, className }: MoneyProps) {
  const value = formatCents(Math.abs(cents));
  const cut = value.lastIndexOf(",");
  const whole = cut > 0 ? value.slice(0, cut) : value;
  const rest = cut > 0 ? value.slice(cut) : "";
  const sign = cents < 0 ? "-" : signed ? "" : "";
  return (
    <span className={className ? `money ${className}` : "money"}>
      {sign}
      {whole}
      <span className="money-cents">{rest}</span>
    </span>
  );
}
