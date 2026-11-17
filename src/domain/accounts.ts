import type { Account, AccountBalance } from "../lib/api";

/** One account with what it holds: its opening balance plus every entry since. */
export interface AccountRow {
  id: number;
  name: string;
  openingCents: number;
  balanceCents: number;
  /** A card's account holds the open invoice, so it reads as a debt rather than money. */
  isCard: boolean;
  /** Created by hand, so it can be renamed and archived. */
  manual: boolean;
}

/** The opening balances are kept as `{ [accountId]: cents }` in one setting. */
export function parseOpening(value: string | null): Record<number, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<number, number> = {};
    for (const [key, cents] of Object.entries(parsed)) {
      const id = Number(key);
      if (Number.isInteger(id) && typeof cents === "number" && Number.isFinite(cents)) {
        result[id] = Math.round(cents);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeOpening(opening: Record<number, number>): string {
  const clean: Record<string, number> = {};
  for (const [key, cents] of Object.entries(opening)) {
    if (cents !== 0) clean[key] = cents;
  }
  return JSON.stringify(clean);
}

export function accountRows(
  accounts: Account[],
  balances: AccountBalance[],
  opening: Record<number, number>,
  cardAccountIds: ReadonlySet<number>,
): AccountRow[] {
  const entries = new Map(balances.map((row) => [row.accountId, row.balanceCents]));
  return accounts.map((account) => {
    const openingCents = opening[account.id] ?? 0;
    return {
      id: account.id,
      name: account.name,
      openingCents,
      balanceCents: openingCents + (entries.get(account.id) ?? 0),
      isCard: cardAccountIds.has(account.id),
      manual: account.bankId === "" && account.acctId.startsWith("manual:"),
    };
  });
}

/** Money you hold: the accounts that are not a card's. */
export function totalHeldCents(rows: AccountRow[]): number {
  return rows.filter((row) => !row.isCard).reduce((sum, row) => sum + row.balanceCents, 0);
}

/** What the cards still owe: the invoices not yet paid out of an account. */
export function totalOwedCents(rows: AccountRow[]): number {
  return -rows.filter((row) => row.isCard).reduce((sum, row) => sum + Math.min(row.balanceCents, 0), 0);
}
