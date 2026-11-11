import { describe, expect, it } from "vitest";
import type { Bill, Person, Share } from "../lib/api";
import { computeSplit, selfPartOf } from "./split";

const people: Person[] = [
  { id: 1, name: "Você", color: "#2563eb", isSelf: true, weightPct: 50 },
  { id: 2, name: "Parceiro(a)", color: "#f43f5e", isSelf: false, weightPct: 50 },
];

const bill = (id: number, amountCents: number): Bill => ({
  id,
  name: `Bill ${id}`,
  amountCents,
  dueDay: 5,
  frequency: "monthly",
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  accountId: null,
  goalId: null,
  startsOn: "2026-01-01",
  endsOn: null,
  installmentsTotal: null,
  active: true,
});

describe("computeSplit", () => {
  it("puts an unassigned bill on me and splits the target evenly", () => {
    const result = computeSplit(people, [], [bill(1, 400_000), bill(2, 200_000)]);

    expect(result.totalCents).toBe(600_000);
    expect(result.selfCents).toBe(600_000);
    expect(result.partnerCents).toBe(0);
    expect(result.selfPct).toBe(100);
    expect(result.partnerPct).toBe(0);
    expect(result.targetSelfPct).toBe(50);
    expect(result.settlementCents).toBe(300_000);
    expect(result.owes).toBe("partner");
    expect(result.partnerPerson?.id).toBe(2);
  });

  it("counts the bills assigned to the other person", () => {
    const shares: Share[] = [{ billId: 2, personId: 2 }];
    const result = computeSplit(people, shares, [bill(1, 300_000), bill(2, 100_000)]);

    expect(result.selfCents).toBe(300_000);
    expect(result.partnerCents).toBe(100_000);
    expect(result.selfPct).toBe(75);
    expect(result.partnerPct).toBe(25);
    expect(result.settlementCents).toBe(100_000);
    expect(result.owes).toBe("partner");
  });

  it("flips the settlement when I took less than my weight", () => {
    const shares: Share[] = [{ billId: 1, personId: 2 }, { billId: 2, personId: 2 }];
    const result = computeSplit(people, shares, [bill(1, 300_000), bill(2, 100_000)]);

    expect(result.selfCents).toBe(0);
    expect(result.settlementCents).toBe(200_000);
    expect(result.owes).toBe("self");
  });

  it("respects a different target weight", () => {
    const weighted: Person[] = [people[0], { ...people[1], weightPct: 40 }];
    const result = computeSplit(weighted, [], [bill(1, 100_000)]);

    expect(result.targetSelfPct).toBe(50);
    const skewed = computeSplit([{ ...people[0], weightPct: 60 }, people[1]], [], [bill(1, 100_000)]);
    expect(skewed.targetSelfPct).toBe(60);
    expect(skewed.settlementCents).toBe(40_000);
  });

  it("is even with no bills and settles to nothing", () => {
    const result = computeSplit(people, [], []);
    expect(result.totalCents).toBe(0);
    expect(result.owes).toBeNull();
    expect(result.settlementCents).toBe(0);
    expect(result.selfPct).toBe(0);
  });

  it("rounds the settlement to the cent", () => {
    const result = computeSplit(people, [], [bill(1, 33_333)]);
    // 33.333 / 2 = 16.666,5 -> the target is 16.667 and the rest is 16.666
    expect(result.settlementCents).toBe(16_666);
  });
});

describe("selfPartOf", () => {
  it("takes my weight of the bill with two people", () => {
    expect(selfPartOf(bill(1, 129_70), people)).toBe(6_485);
  });

  it("returns null for a single-person household", () => {
    expect(selfPartOf(bill(1, 129_70), [people[0]])).toBeNull();
    expect(selfPartOf(bill(1, 129_70), [])).toBeNull();
  });
});
