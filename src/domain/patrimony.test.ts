import { describe, expect, it } from "vitest";
import type { MonthPoint } from "../lib/api";
import { holdingsByKind, holdingsTotal, investmentLines, investmentSummary, netWorthCurve, totalWealth } from "./patrimony";

const point = (month: string, incomeCents: number, expenseCents: number): MonthPoint => ({
  month,
  incomeCents,
  expenseCents,
});

describe("netWorthCurve", () => {
  it("accumulates the monthly net from zero", () => {
    const curve = netWorthCurve([
      point("2026-09", 5_000_00, 3_000_00),
      point("2026-10", 5_000_00, 6_000_00),
      point("2026-11", 5_000_00, 3_000_00),
    ]);
    expect(curve.map((entry) => entry.netCents)).toEqual([2_000_00, -1_000_00, 2_000_00]);
    expect(curve.map((entry) => entry.runningCents)).toEqual([2_000_00, 1_000_00, 3_000_00]);
  });

  it("stays empty without history", () => {
    expect(netWorthCurve([])).toEqual([]);
  });
});

describe("holdings", () => {
  it("adds up and groups by kind, biggest first", () => {
    const holdings = [
      { kind: "cash", amountCents: 1000 },
      { kind: "investment", amountCents: 5000 },
      { kind: "cash", amountCents: 2000 },
    ];
    expect(holdingsTotal(holdings)).toBe(8000);
    expect(holdingsByKind(holdings)).toEqual([
      { kind: "investment", totalCents: 5000 },
      { kind: "cash", totalCents: 3000 },
    ]);
    expect(holdingsTotal([])).toBe(0);
  });

  it("joins reserves, accumulation and holdings into one total", () => {
    expect(totalWealth(2000, 3000, 8000)).toBe(13000);
  });
});

describe("investments", () => {
  const holdings = [
    { id: 1, name: "CDB", kind: "investment", amountCents: 110_00, costCents: 100_00 },
    { id: 2, name: "Fundo", kind: "investment", amountCents: 90_00, costCents: 100_00 },
    { id: 3, name: "Sem custo", kind: "investment", amountCents: 200_00, costCents: 0 },
    { id: 4, name: "Carro", kind: "property", amountCents: 9_000_00, costCents: 0 },
  ];

  it("keeps only investments, biggest first, with their share", () => {
    const lines = investmentLines(holdings);
    expect(lines.map((line) => line.name)).toEqual(["Sem custo", "CDB", "Fundo"]);
    expect(lines[0].sharePct).toBeCloseTo(50);
  });

  it("only compares value with cost where the cost is known", () => {
    const lines = investmentLines(holdings);
    const summary = investmentSummary(lines);
    expect(lines.find((line) => line.name === "Sem custo")?.gainPct).toBeNull();
    expect(summary.valueCents).toBe(400_00);
    expect(summary.gainCents).toBe(0);
    expect(summary.gainPct).toBe(0);
    expect(summary.untracked).toBe(1);
  });

  it("has no return at all when nothing reports a cost", () => {
    const summary = investmentSummary(investmentLines([holdings[2]]));
    expect(summary.gainPct).toBeNull();
  });
});
