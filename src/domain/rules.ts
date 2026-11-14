type RuleTarget = "merchant" | "description" | "both";
type RuleSign = "any" | "in" | "out";

export interface RuleLike {
  pattern: string;
  target: RuleTarget;
  categoryId: number;
  sign: RuleSign;
  minAmountCents: number | null;
  maxAmountCents: number | null;
  priority: number;
}

export interface RuleEntry {
  description: string;
  merchant: string;
  amountCents: number;
}

/**
 * One auto-categorization rule: a case-insensitive substring plus optional
 * amount bounds. Matching is deliberately boring — `includes`, no regex —
 * so the SQLite side can implement exactly the same predicate.
 */
export function ruleMatches(rule: RuleLike, entry: RuleEntry): boolean {
  const needle = rule.pattern.trim().toLowerCase();
  if (!needle) return false;
  const haystacks =
    rule.target === "merchant"
      ? [entry.merchant]
      : rule.target === "description"
        ? [entry.description]
        : [entry.merchant, entry.description];
  const hit = haystacks.some((text) => text.toLowerCase().includes(needle));
  if (!hit) return false;
  if (rule.sign === "in" && entry.amountCents <= 0) return false;
  if (rule.sign === "out" && entry.amountCents >= 0) return false;
  if (rule.minAmountCents !== null && entry.amountCents < rule.minAmountCents) return false;
  if (rule.maxAmountCents !== null && entry.amountCents > rule.maxAmountCents) return false;
  return true;
}

/**
 * First match wins: lowest priority, then array order. Returns the category
 * id or null when nothing matches.
 */
export function categorizeWithRules(rules: RuleLike[], entry: RuleEntry): number | null {
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (ruleMatches(rule, entry)) return rule.categoryId;
  }
  return null;
}
