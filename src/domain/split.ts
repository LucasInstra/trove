/**
 * Who pays what in the house.
 *
 * Every bill has exactly one payer. Each person also carries a target weight,
 * which is the share they are supposed to bear. The gap between what I actually
 * took and my weight is the settlement: whoever paid more is owed the rest.
 */

import type { Bill, Person, Share } from "../lib/api";

export interface SplitLine {
  bill: Bill;
  person: Person | null;
  amountCents: number;
}

export interface SplitResult {
  totalCents: number;
  selfCents: number;
  partnerCents: number;
  selfPct: number;
  partnerPct: number;
  targetSelfPct: number;
  settlementCents: number;
  owes: "self" | "partner" | null;
  selfPerson: Person | null;
  partnerPerson: Person | null;
  lines: SplitLine[];
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * My slice of one bill by target weight, the "sua parte" of the mockup. Null
 * for a single-person household, where the whole bill is already mine.
 */
export function selfPartOf(bill: Bill, people: Person[]): number | null {
  if (people.length < 2) return null;
  const self = people.find((person) => person.isSelf) ?? people[0];
  const weight = self?.weightPct ?? 50;
  return Math.round((bill.amountCents * weight) / 100);
}

export function computeSplit(people: Person[], shares: Share[], bills: Bill[]): SplitResult {
  const selfPerson = people.find((person) => person.isSelf) ?? people[0] ?? null;
  const partnerPerson = people.find((person) => !person.isSelf) ?? null;

  const lines: SplitLine[] = bills.map((bill) => {
    const share = shares.find((entry) => entry.billId === bill.id);
    const person = share
      ? (people.find((entry) => entry.id === share.personId) ?? selfPerson)
      : selfPerson;
    return { bill, person, amountCents: bill.amountCents };
  });

  const totalCents = sum(lines.map((line) => line.amountCents));
  const selfCents = sum(
    lines.filter((line) => line.person && line.person.isSelf).map((line) => line.amountCents),
  );
  const partnerCents = totalCents - selfCents;

  const share = (value: number) => (totalCents > 0 ? Math.round((value / totalCents) * 1000) / 10 : 0);
  const targetSelfPct = selfPerson?.weightPct ?? 50;
  const targetSelfCents = Math.round((totalCents * targetSelfPct) / 100);
  const balance = selfCents - targetSelfCents;

  return {
    totalCents,
    selfCents,
    partnerCents,
    selfPct: share(selfCents),
    partnerPct: share(partnerCents),
    targetSelfPct,
    settlementCents: Math.abs(balance),
    owes: balance > 0 ? "partner" : balance < 0 ? "self" : null,
    selfPerson,
    partnerPerson,
    lines,
  };
}
