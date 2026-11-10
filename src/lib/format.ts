import type { Lang } from "./i18n";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

export function formatSignedCents(cents: number): string {
  const text = brl.format(Math.abs(cents) / 100);
  return cents < 0 ? `-${text}` : text;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

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
