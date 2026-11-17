import { describe, expect, it } from "vitest";
import type { Account } from "../lib/api";
import { accountRows, parseOpening, serializeOpening, totalHeldCents, totalOwedCents } from "./accounts";

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

  it("round-trips the setting and ignores junk", () => {
    expect(parseOpening(serializeOpening({ 1: 500, 2: 0 }))).toEqual({ 1: 500 });
    expect(parseOpening("not json")).toEqual({});
    expect(parseOpening('[1,2]')).toEqual({});
    expect(parseOpening(null)).toEqual({});
  });
});
