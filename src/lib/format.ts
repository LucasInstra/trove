import type { Lang } from "./i18n";

import { MASK, isPrivate } from "./privacy";

/** The currencies the app can show amounts in. Only the symbol changes: nothing is converted. */
export const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "CAD", "AUD", "MXN", "ARS"] as const;
export type DisplayCurrency = (typeof CURRENCIES)[number];

let currency: DisplayCurrency = "BRL";
let brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency });

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function setDisplayCurrency(next: DisplayCurrency): void {
  if (next === currency) return;
  currency = next;
  brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
}

export function currencySymbol(code: DisplayCurrency = currency): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code })
    .format(0)
    .replace(/[\d.,\s\u00a0]/g, "");
}

/** "BRL · R$ Real brasileiro" in the app's language, for the picker. */
export function currencyLabel(code: DisplayCurrency, lang: Lang): string {
  const locale = lang === "pt" ? "pt-BR" : "en-GB";
  const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
  const symbol = currencySymbol(code);
  return `${code} · ${symbol} ${name}`;
}

export function displayCurrency(): DisplayCurrency {
  return currency;
}

export function maskedAmount(): string {
  return currency === "BRL" ? MASK : `${currencySymbol(currency)} ••••`;
}

/** "R$ 1,00" with the sign tucked in after the currency: "R$ -1,00". */
function withSign(cents: number, plus: boolean): string {
  const text = brl.format(Math.abs(cents) / 100);
  const sign = cents < 0 ? "-" : plus && cents > 0 ? "+" : "";
  if (!sign) return text;
  const match = text.match(/^(\D*?\s+)(\d.*)$/);
  return match ? `${match[1]}${sign}${match[2]}` : `${sign}${text}`;
}

export function formatCents(cents: number): string {
  if (isPrivate()) return maskedAmount();
  return withSign(cents, false);
}

export function formatSignedCents(cents: number): string {
  return formatCents(cents);
}

/** An amount that always shows its direction, "R$ +85,00" or "R$ -85,00"; masked, no sign leaks. */
export function formatDelta(cents: number): string {
  if (isPrivate()) return maskedAmount();
  return withSign(cents, true);
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Today in the user's own calendar, not in UTC: a bill due today is due today. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export { addMonths as shiftMonth } from "../domain/month";

const MONTHS: Record<Lang, string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  pt: [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ],
};

const SHORT_MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
};

export function monthLabel(month: string, lang: Lang = "en"): string {
  const [year, value] = month.split("-");
  const name = MONTHS[lang][Number(value) - 1];
  if (!name || !year) return month;
  return lang === "pt" ? `${name} de ${year}` : `${name} ${year}`;
}

/** "November" / "Novembro", capitalised in both languages. */
export function monthName(month: string, lang: Lang = "en"): string {
  const [, value] = month.split("-");
  const name = MONTHS[lang][Number(value) - 1] ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function monthShort(month: string, lang: Lang = "en"): string {
  const [, value] = month.split("-");
  return SHORT_MONTHS[lang][Number(value) - 1] ?? month;
}

export function dayLabel(iso: string, lang: Lang = "en"): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(lang === "pt" ? "pt-BR" : "en-GB", {
    day: "numeric",
    month: "long",
  });
}

export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function formatDateTime(iso: string, lang: Lang = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(lang === "pt" ? "pt-BR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A card's account is named "Brand •••• 1234"; the digits are shown on their own, so drop them here. */
export function holderName(accountName: string): string {
  return accountName.replace(/\s*[•·.*]{2,}\s*\d*\s*$/u, "").trim() || accountName;
}
