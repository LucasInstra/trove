import { describe, expect, it } from "vitest";
import type { MonthPoint } from "../lib/api";
import { annualRate, monthsLeft, holdingsByKind, holdingsTotal, investmentLines, investmentSummary, netWorthCurve, totalWealth } from "./patrimony";

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

  it("turns an indexer and a rate into a yearly return", () => {
    const rates = { cdiPct: 10, ipcaPct: 5 };
    expect(annualRate("cdi", 11000, rates)).toBeCloseTo(0.11);
    expect(annualRate("selic", 10000, rates)).toBeCloseTo(0.1);
    expect(annualRate("ipca", 600, rates)).toBeCloseTo(1.05 * 1.06 - 1);
    expect(annualRate("fixed", 1250, rates)).toBeCloseTo(0.125);
    expect(annualRate("none", 1250, rates)).toBeNull();
    expect(annualRate("cdi", 0, rates)).toBeNull();
  });

  it("counts the months left of a term", () => {
    expect(monthsLeft("2026-01-10", 24, "2026-12-09")).toBe(14);
    expect(monthsLeft("2026-01-10", 24, "2026-12-10")).toBe(13);
    expect(monthsLeft("2024-01-01", 12, "2026-12-01")).toBe(0);
    expect(monthsLeft("", 12, "2026-12-01")).toBeNull();
    expect(monthsLeft("2026-01-01", 0, "2026-12-01")).toBeNull();
  });

  it("estimates the monthly yield and the value at the end of the term", () => {
    const line = investmentLines(
      [{ id: 1, name: "CDB", kind: "investment", amountCents: 100_000_00, costCents: 0, indexer: "fixed", rateBps: 1200, termMonths: 12, startedOn: "2026-01-01" }],
      { cdiPct: 10, ipcaPct: 5 },
      "2026-07-01",
    )[0];
    expect(line.monthsLeft).toBe(6);
    expect(line.monthlyYieldCents).toBe(Math.round(100_000_00 * (Math.pow(1.12, 1 / 12) - 1)));
    expect(line.projectedCents).toBe(Math.round(100_000_00 * Math.pow(1.12, 0.5)));
    expect(investmentSummary([line]).withRate).toBe(1);
  });
});
