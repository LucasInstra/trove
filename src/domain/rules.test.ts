import { describe, expect, it } from "vitest";
import { categorizeWithRules, ruleMatches, type RuleLike } from "./rules";

const base: RuleLike = {
  pattern: "ifood",
  target: "both",
  categoryId: 7,
  sign: "any",
  minAmountCents: null,
  maxAmountCents: null,
  priority: 0,
};

describe("ruleMatches", () => {
  it("matches a substring in either field, case-insensitively", () => {
    expect(ruleMatches(base, { description: "IFD*IFOOD SP", merchant: "IFOOD", amountCents: -2390 })).toBe(true);
    expect(ruleMatches(base, { description: "Mercado", merchant: "Pão de Açúcar", amountCents: -100 })).toBe(false);
  });

  it("respects the target field", () => {
    const merchantOnly = { ...base, target: "merchant" as const };
    expect(ruleMatches(merchantOnly, { description: "ifood", merchant: "X", amountCents: -1 })).toBe(false);
    expect(ruleMatches(merchantOnly, { description: "X", merchant: "ifood", amountCents: -1 })).toBe(true);
  });

  it("an empty pattern never matches", () => {
    expect(ruleMatches({ ...base, pattern: "  " }, { description: "ifood", merchant: "", amountCents: -1 })).toBe(false);
  });

  it("filters by sign and amount bounds", () => {
    expect(ruleMatches({ ...base, sign: "out" }, { description: "ifood", merchant: "", amountCents: 100 })).toBe(false);
    expect(ruleMatches({ ...base, sign: "in" }, { description: "ifood", merchant: "", amountCents: 100 })).toBe(true);
    const bounded = { ...base, minAmountCents: -5000, maxAmountCents: -1000 };
    expect(ruleMatches(bounded, { description: "ifood", merchant: "", amountCents: -2390 })).toBe(true);
    expect(ruleMatches(bounded, { description: "ifood", merchant: "", amountCents: -100 })).toBe(false);
  });
});

describe("categorizeWithRules", () => {
  it("first match wins by priority, then order", () => {
    const rules: RuleLike[] = [
      { ...base, categoryId: 1, priority: 10 },
      { ...base, categoryId: 2, priority: 1 },
    ];
    expect(categorizeWithRules(rules, { description: "ifood", merchant: "", amountCents: -1 })).toBe(2);
    expect(categorizeWithRules(rules, { description: "farmácia", merchant: "", amountCents: -1 })).toBe(null);
  });
});
