import { annualRate, DEFAULT_RATES, type RateAssumptions } from "./patrimony";

export interface SheetHolding {
  amountCents: number;
  costCents: number;
  indexer?: string;
  rateBps?: number;
  termMonths?: number;
  startedOn?: string;
  maturityOn?: string;
  taxable?: boolean;
}

export type SheetStatus = "running" | "matured" | "open";

export interface SheetLine {
  /** Days since the application; null without a start date. */
  daysElapsed: number | null;
  /** Days to maturity; negative once matured; null without a maturity. */
  daysToMaturity: number | null;
  status: SheetStatus;
  annualRate: number | null;
  /** Estimated value today; falls back to the typed value when there is not enough to estimate. */
  valueCents: number;
  estimated: boolean;
  grossCents: number | null;
  grossPct: number | null;
  irRate: number | null;
  irCents: number | null;
  netCents: number | null;
}

const DAY_MS = 86_400_000;

function toUtc(iso: string): number | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (YYYY-MM-DD); null when either is invalid. */
export function daysBetween(from: string, to: string): number | null {
  const a = toUtc(from);
  const b = toUtc(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

/** Maturity date: the typed one, or start plus the old term in months. */
export function maturityOf(holding: Pick<SheetHolding, "maturityOn" | "startedOn" | "termMonths">): string {
  if (holding.maturityOn) return holding.maturityOn;
  if (!holding.startedOn || !holding.termMonths || holding.termMonths <= 0) return "";
  const [y, m, d] = holding.startedOn.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return "";
  const date = new Date(Date.UTC(y, m - 1 + holding.termMonths, d));
  return date.toISOString().slice(0, 10);
}

/** Regressive income tax by days held: 22.5% up to 180, 20% to 360, 17.5% to 720, 15% above. */
export function irRateFor(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

/**
 * One spreadsheet row: everything after the typed columns. Compound interest
 * on the amount put in, 365-day year. Without a start date, an amount put in
 * or a rate there is nothing to estimate, so the typed value stays and the
 * derived columns are empty.
 */
export function sheetLine(
  holding: SheetHolding,
  rates: RateAssumptions = DEFAULT_RATES,
  today: string = new Date().toISOString().slice(0, 10),
): SheetLine {
  const maturity = maturityOf(holding);
  const daysElapsed = holding.startedOn ? daysBetween(holding.startedOn, today) : null;
  const daysToMaturity = maturity ? daysBetween(today, maturity) : null;
  const status: SheetStatus =
    daysToMaturity === null ? "open" : daysToMaturity < 0 ? "matured" : "running";
  const yearly = annualRate(holding.indexer, holding.rateBps, rates);
  const canEstimate = yearly !== null && daysElapsed !== null && daysElapsed >= 0 && holding.costCents > 0;
  if (!canEstimate) {
    return {
      daysElapsed,
      daysToMaturity,
      status,
      annualRate: yearly,
      valueCents: holding.amountCents,
      estimated: false,
      grossCents: null,
      grossPct: null,
      irRate: null,
      irCents: null,
      netCents: null,
    };
  }
  const valueCents = Math.round(holding.costCents * Math.pow(1 + yearly, daysElapsed / 365));
  const grossCents = valueCents - holding.costCents;
  const irRate = holding.taxable === false ? 0 : irRateFor(daysElapsed);
  const irCents = Math.round(Math.max(0, grossCents) * irRate);
  return {
    daysElapsed,
    daysToMaturity,
    status,
    annualRate: yearly,
    valueCents,
    estimated: true,
    grossCents,
    grossPct: (grossCents / holding.costCents) * 100,
    irRate,
    irCents,
    netCents: grossCents - irCents,
  };
}

export const PRODUCTS = [
  "CDB",
  "LC",
  "LCI",
  "LCA",
  "LIG",
  "CRI",
  "CRA",
  "Debênture",
  "Tesouro Selic",
  "Tesouro IPCA+",
  "Tesouro Prefixado",
  "Tesouro Direto",
  "Poupança",
  "Fundo",
  "Fundo imobiliário",
  "Ações",
  "ETF",
  "BDR",
  "COE",
  "Previdência",
  "Cripto",
  "Outro",
];

/** The date `months` after `iso`, clamped to the end of a shorter month (31 Jan + 1 = 28/29 Feb). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return "";
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Whole months from one date to a later one (rounded, never negative); null if either is missing. */
export function monthsBetweenIso(from: string, to: string): number | null {
  if (!from || !to) return null;
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  if (![y1, m1, d1, y2, m2, d2].every(Number.isFinite)) return null;
  const months = (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30;
  return Math.max(0, Math.round(months));
}

/**
 * Start date, term and maturity are three views of one fact. After one of them changes,
 * this works out the other two so the sheet and the net-worth screens never disagree.
 */
export function reconcileTerm(
  next: { startedOn?: string; maturityOn?: string; termMonths?: number },
  changed: "start" | "maturity" | "term",
): { startedOn: string; maturityOn: string; termMonths: number } {
  const startedOn = next.startedOn ?? "";
  let maturityOn = next.maturityOn ?? "";
  let termMonths = next.termMonths ?? 0;
  if (changed === "maturity") {
    termMonths = maturityOn && startedOn ? (monthsBetweenIso(startedOn, maturityOn) ?? 0) : 0;
  } else if (changed === "term") {
    maturityOn = startedOn && termMonths > 0 ? addMonthsIso(startedOn, termMonths) : termMonths > 0 ? maturityOn : "";
  } else if (maturityOn && startedOn) {
    termMonths = monthsBetweenIso(startedOn, maturityOn) ?? termMonths;
  } else if (startedOn && termMonths > 0) {
    maturityOn = addMonthsIso(startedOn, termMonths);
  }
  return { startedOn, maturityOn, termMonths };
}
