import type { Bill, BillPayment, Goal, GoalTotal, Income, MonthTotals } from "../lib/api";

export interface Composition {
  key: "housing" | "bills" | "spent" | "free";
  amountCents: number;
  sharePct: number;
}

export interface DayGroup {
  day: number;
  count: number;
  totalCents: number;
}

export interface GoalProgress {
  goal: Goal;
  paidCents: number;
  sharePct: number;
}

export interface MonthPlan {
  month: string;
  incomeCents: number;
  plannedCents: number;
  paidCents: number;
  realizedCents: number;
  forecastCents: number;
  overCents: number;
  hasPlan: boolean;
  dueBills: Bill[];
  paidBillIds: number[];
  pendingBillIds: number[];
  dayGroups: DayGroup[];
  composition: Composition[];
  housingCents: number;
  housingRatioPct: number;
  ceilingPct: number;
  overCeiling: boolean;
  goals: GoalProgress[];
}

export interface PlanInput {
  month: string;
  incomes: Income[];
  bills: Bill[];
  payments: BillPayment[];
  goals: Goal[];
  goalTotals: GoalTotal[];
  totals: MonthTotals | null;
  housingCategoryId: number | null;
  ceilingPct: number;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** A bill belongs to a month when it is active and the month is inside its life. */
export function isDueIn(bill: Bill, month: string): boolean {
  if (!bill.active) return false;
  const start = bill.startsOn.slice(0, 7);
  const end = bill.endsOn ? bill.endsOn.slice(0, 7) : null;
  if (start > month) return false;
  if (end && end < month) return false;
  if (bill.frequency === "once") return start === month;
  return true;
}

export function groupByDay(bills: Bill[]): DayGroup[] {
  const map = new Map<number, DayGroup>();
  for (const bill of bills) {
    const entry = map.get(bill.dueDay) ?? { day: bill.dueDay, count: 0, totalCents: 0 };
    entry.count += 1;
    entry.totalCents += bill.amountCents;
    map.set(bill.dueDay, entry);
  }
  return [...map.values()].sort((left, right) => left.day - right.day);
}

/**
 * The bar always starts from the income and ends at what is left. When the month
 * is already overspent the committed part fills the whole track and the overflow
 * is reported separately, so the bar never claims more than 100%.
 */
export function buildComposition(
  incomeCents: number,
  committedCents: number,
  forecastCents: number,
  hasPlan: boolean,
  housingCents = 0,
): Composition[] {
  if (incomeCents <= 0 && committedCents <= 0) return [];
  const base = Math.max(incomeCents, committedCents, 1);
  const share = (value: number) => Math.round((value / base) * 1000) / 10;

  if (forecastCents < 0) {
    const parts: Composition[] = [];
    if (housingCents > 0) {
      parts.push({ key: "housing", amountCents: housingCents, sharePct: share(housingCents) });
    }
    parts.push({ key: hasPlan ? "bills" : "spent", amountCents: committedCents - housingCents, sharePct: share(committedCents - housingCents) });
    return parts;
  }

  const parts: Composition[] = [];
  if (hasPlan && housingCents > 0) {
    parts.push({ key: "housing", amountCents: housingCents, sharePct: share(housingCents) });
  }
  parts.push({
    key: hasPlan ? "bills" : "spent",
    amountCents: hasPlan ? committedCents - housingCents : committedCents,
    sharePct: share(hasPlan ? committedCents - housingCents : committedCents),
  });
  parts.push({ key: "free", amountCents: forecastCents, sharePct: share(forecastCents) });
  return parts.filter((part) => part.amountCents > 0);
}

export function planMonth(input: PlanInput): MonthPlan {
  const month = input.month;
  const totals = input.totals ?? { month, incomeCents: 0, expenseCents: 0, transactionCount: 0 };
  const monthlyIncome = sum(
    input.incomes
      .filter((income) => income.active && income.frequency === "monthly")
      .map((income) => income.amountCents),
  );
  // The plan is the source of truth for what is expected; the statement is the
  // fallback so someone who never set an income still sees real numbers.
  const incomeCents = monthlyIncome > 0 ? monthlyIncome : totals.incomeCents;

  const dueBills = input.bills
    .filter((bill) => isDueIn(bill, month))
    .sort((left, right) => left.dueDay - right.dueDay);
  const plannedCents = sum(dueBills.map((bill) => bill.amountCents));
  const paidBillIds = input.payments
    .filter((payment) => dueBills.some((bill) => bill.id === payment.billId))
    .map((payment) => payment.billId);
  const paidCents = sum(
    input.payments
      .filter((payment) => paidBillIds.includes(payment.billId))
      .map((payment) => payment.amountCents),
  );
  const realizedCents = totals.expenseCents;
  const hasPlan = dueBills.length > 0;
  const committedCents = hasPlan ? plannedCents : realizedCents;
  const forecastCents = incomeCents - committedCents;

  const housingCents =
    input.housingCategoryId === null
      ? 0
      : sum(
          dueBills
            .filter((bill) => bill.categoryId === input.housingCategoryId)
            .map((bill) => bill.amountCents),
        );
  const housingRatioPct =
    incomeCents > 0 ? Math.round((housingCents / incomeCents) * 1000) / 10 : 0;

  const goals: GoalProgress[] = input.goals.map((goal) => {
    const total = input.goalTotals.find((entry) => entry.goalId === goal.id);
    const paid = total?.paidCents ?? 0;
    const sharePct =
      goal.targetCents > 0 ? Math.min(100, Math.round((paid / goal.targetCents) * 1000) / 10) : 0;
    return { goal, paidCents: paid, sharePct };
  });

  return {
    month,
    incomeCents,
    plannedCents,
    paidCents,
    realizedCents,
    forecastCents,
    overCents: Math.max(0, -forecastCents),
    hasPlan,
    dueBills,
    paidBillIds,
    pendingBillIds: dueBills
      .filter((bill) => !paidBillIds.includes(bill.id))
      .map((bill) => bill.id),
    dayGroups: groupByDay(dueBills),
    composition: buildComposition(incomeCents, committedCents, forecastCents, hasPlan, housingCents),
    housingCents,
    housingRatioPct,
    ceilingPct: input.ceilingPct,
    overCeiling: housingRatioPct > input.ceilingPct,
    goals,
  };
}
