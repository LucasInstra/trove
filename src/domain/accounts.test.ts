import { describe, expect, it } from "vitest";
import type { Account } from "../lib/api";
import { accountRows, salaryAccountId, parseOpening, serializeOpening, totalBalanceKnown, totalHeldCents, totalMonthCents, totalOwedCents } from "./accounts";

const account = (id: number, name: string): Account => ({
  id,
  name,
  kind: "checking",
  bankId: "",
  acctId: `manual:${id}`,
  currency: "BRL",
});

describe("account balances", () => {
  const accounts = [account(1, "Main"), account(2, "Savings"), account(3, "Visa")];
  const balances = [
    { accountId: 1, balanceCents: 10_000 },
    { accountId: 2, balanceCents: 5_000 },
    { accountId: 3, balanceCents: -3_000 },
  ];

  it("adds the opening balance to what the entries sum to", () => {
    const rows = accountRows(accounts, balances, { 1: 20_000 }, new Set([3]));
    expect(rows.map((row) => row.balanceCents)).toEqual([30_000, 5_000, -3_000]);
    expect(rows[0].openingCents).toBe(20_000);
  });

  it("keeps card accounts out of the money held and reports what they owe", () => {
    const rows = accountRows(accounts, balances, {}, new Set([3]));
    expect(totalHeldCents(rows)).toBe(15_000);
    expect(totalOwedCents(rows)).toBe(3_000);
  });

  it("treats an account with no entries as its opening balance", () => {
    const rows = accountRows([account(9, "New")], [], { 9: 4_000 }, new Set());
    expect(rows[0].balanceCents).toBe(4_000);
  });

  it("reports the month result and knows when a balance is the person's own", () => {
    const results = [
      { accountId: 1, resultCents: 2_000 },
      { accountId: 2, resultCents: -500 },
      { accountId: 3, resultCents: -3_000 },
    ];
    const rows = accountRows(accounts, balances, { 1: 20_000 }, new Set([3]), results);
    expect(rows.map((row) => row.monthCents)).toEqual([2_000, -500, -3_000]);
    expect(totalMonthCents(rows)).toBe(1_500);
    expect(rows.map((row) => row.hasOpening)).toEqual([true, false, false]);
    expect(totalBalanceKnown(rows)).toBe(false);
    const all = accountRows(accounts, balances, { 1: 1, 2: 1 }, new Set([3]), results);
    expect(totalBalanceKnown(all)).toBe(true);
  });

  it("counts the salary on the account that receives it", () => {
    const results = [
      { accountId: 1, resultCents: -6_145 },
      { accountId: 2, resultCents: 0 },
    ];
    const rows = accountRows(accounts, balances, {}, new Set([3]), results, { accountId: 1, cents: 300_000 });
    expect(rows.map((row) => row.monthCents)).toEqual([293_855, 0, 0]);
  });

  it("sends the salary to the chosen account, else to the first account of money", () => {
    const cards = new Set([3]);
    expect(salaryAccountId(accounts, cards, 2)).toBe(2);
    expect(salaryAccountId(accounts, cards, null)).toBe(1);
    expect(salaryAccountId(accounts, cards, 3)).toBe(1);
    expect(salaryAccountId(accounts, new Set(), 3)).toBe(3);
    expect(salaryAccountId([], cards, 3)).toBeUndefined();
  });

  it("round-trips the setting and ignores junk", () => {
    expect(parseOpening(serializeOpening({ 1: 500, 2: 0 }))).toEqual({ 1: 500 });
    expect(parseOpening("not json")).toEqual({});
    expect(parseOpening('[1,2]')).toEqual({});
    expect(parseOpening(null)).toEqual({});
  });
});
