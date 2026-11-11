import { addMonths } from "./month";

export interface LedgerRow {
  postedOn: string;
  merchant: string;
  description: string;
  amountCents: number;
}

export type RecurrenceStatus = "due" | "overdue" | "scheduled";

export interface RecurringCharge {
  label: string;
  amountCents: number;
  occurrences: number;
  dayOfMonth: number;
  lastOn: string;
  nextMonth: string;
  status: RecurrenceStatus;
}

const keyOf = (row: LedgerRow): string => {
  const raw = (row.merchant || row.description).toLowerCase().trim().replace(/\s+/g, " ");
  return `${raw}|${row.amountCents}`;
};

const median = (values: number[]): number => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
};

const mode = (values: number[]): number => {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
};

/**
 * Subscriptions hiding in the ledger: same merchant and same amount, roughly
 * every month. Needs three sightings and a median gap of 25-35 days, so two
 * identical grocery runs never qualify and varying bills (power, water)
 * split into their own amounts instead of faking a subscription.
 */
export function detectRecurring(rows: LedgerRow[], currentMonth: string): RecurringCharge[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    if (row.amountCents === 0) continue;
    const list = groups.get(keyOf(row)) ?? [];
    list.push(row);
    groups.set(keyOf(row), list);
  }

  const found: RecurringCharge[] = [];
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    const ordered = [...list].sort((a, b) => (a.postedOn < b.postedOn ? -1 : 1));
    const days = ordered.map((row) => new Date(`${row.postedOn}T12:00:00Z`).getTime());
    const gaps = days.slice(1).map((time, index) => Math.round((time - days[index]) / 86400000));
    const step = median(gaps);
    if (step < 25 || step > 35) continue;

    const label = ordered[0].merchant || ordered[0].description || "?";
    const dayOfMonth = mode(ordered.map((row) => Number(row.postedOn.slice(8, 10))));
    let nextMonth = addMonths(ordered[ordered.length - 1].postedOn.slice(0, 7), 1);
    const covered = new Set(ordered.map((row) => row.postedOn.slice(0, 7)));
    for (let guard = 0; guard < 6 && covered.has(nextMonth); guard++) {
      nextMonth = addMonths(nextMonth, 1);
    }
    found.push({
      label,
      amountCents: ordered[0].amountCents,
      occurrences: ordered.length,
      dayOfMonth,
      lastOn: ordered[ordered.length - 1].postedOn,
      nextMonth,
      status: nextMonth < currentMonth ? "overdue" : nextMonth === currentMonth ? "due" : "scheduled",
    });
  }

  const rank = { overdue: 0, due: 1, scheduled: 2 } as const;
  return found
    .sort(
      (a, b) => rank[a.status] - rank[b.status] || Math.abs(b.amountCents) - Math.abs(a.amountCents),
    )
    .slice(0, 12);
}
