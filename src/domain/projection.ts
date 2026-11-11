import type { Bill, BillPayment, Debt, Goal, GoalTotal, Income, MonthTotals } from "../lib/api";
import { monthOffset } from "./installment";

export interface Composition {
  key: "personal" | "housing" | "reserved" | "receivable" | "free";
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
  primaryIncomeCents: number;
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
  housingBills: Bill[];
  housingRatioPct: number;
  housingRatioPrimaryPct: number;
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
  /** Debts of the month; absent in old tests, treated as none. */
  debts?: Debt[];
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
  // An installment purchase only lives for its parcels: the run starts at
  // `startsOn` and lasts `installmentsTotal` months. An explicit end still
  // shortens it, never extends it.
  if (
    bill.installmentsTotal !== null &&
    bill.installmentsTotal !== undefined &&
    bill.installmentsTotal >= 1
  ) {
    return monthOffset(start, month) < Math.floor(bill.installmentsTotal);
  }
  return true;
}

/** The biggest active monthly income, which is the one the app treats as mine. */
export function primaryOf(incomes: Income[]): number {
  const monthly = incomes.filter((income) => income.active && income.frequency === "monthly");
  if (monthly.length === 0) return 0;
  return Math.max(...monthly.map((income) => income.amountCents));
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
 * The bar starts from everything available and ends at what is left. Money
 * other people owe me rides along as its own band but never funds the free
 * part: only income minus what is committed counts as free. When the month is
 * already overspent the free band drops out and the committed bands fill the
 * whole track, so the bar never claims more than the base it measures.
 */
export function buildComposition(input: {
  incomeCents: number;
  personalCents: number;
  houseCents: number;
  reservedCents: number;
  receivableCents: number;
}): Composition[] {
  const { incomeCents } = input;
  const committedCents = input.personalCents + input.houseCents + input.reservedCents;
  const freeCents = incomeCents - committedCents;
  if (incomeCents <= 0 && committedCents <= 0 && input.receivableCents <= 0) return [];
  const base = Math.max(incomeCents, committedCents, input.receivableCents, 1);
  const share = (value: number) => Math.round((value / base) * 1000) / 10;

  const parts: Composition[] = [];
  if (input.personalCents > 0) {
    parts.push({ key: "personal", amountCents: input.personalCents, sharePct: share(input.personalCents) });
  }
  if (input.houseCents > 0) {
    parts.push({ key: "housing", amountCents: input.houseCents, sharePct: share(input.houseCents) });
  }
  if (input.reservedCents > 0) {
    parts.push({ key: "reserved", amountCents: input.reservedCents, sharePct: share(input.reservedCents) });
  }
  if (freeCents > 0) {
    parts.push({ key: "free", amountCents: freeCents, sharePct: share(freeCents) });
  }
  if (input.receivableCents > 0) {
    parts.push({
      key: "receivable",
      amountCents: input.receivableCents,
      sharePct: share(input.receivableCents),
    });
  }
  return parts;
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

  // The bills and the total come from the same filter: the housing screen lists
  // what this number is made of, and two copies of the rule would drift.
  const housingBills =
    input.housingCategoryId === null
      ? []
      : dueBills.filter((bill) => bill.categoryId === input.housingCategoryId);
  const housingCents = sum(housingBills.map((bill) => bill.amountCents));
  const housingRatioPct =
    incomeCents > 0 ? Math.round((housingCents / incomeCents) * 1000) / 10 : 0;
  // The app is single-person, so "my income" is the biggest active salary. It is
  // a rule, not a hidden model: no owner field exists yet.
  const primaryIncomeCents = monthlyIncome > 0 ? primaryOf(input.incomes) : totals.incomeCents;
  const housingRatioPrimaryPct =
    primaryIncomeCents > 0
      ? Math.round((housingCents / primaryIncomeCents) * 1000) / 10
      : 0;

  const goals: GoalProgress[] = input.goals.map((goal) => {
    const total = input.goalTotals.find((entry) => entry.goalId === goal.id);
    const paid = total?.paidCents ?? 0;
    const sharePct =
      goal.targetCents > 0 ? Math.min(100, Math.round((paid / goal.targetCents) * 1000) / 10) : 0;
    return { goal, paidCents: paid, sharePct };
  });

  // The house gets its own band, so the personal band is everything committed
  // minus the house. Reserve goals earmark a monthly slice, and money others
  // still owe me rides along without funding the free part.
  const reservedCents = sum(
    input.goals.filter((goal) => goal.kind === "reserve").map((goal) => goal.monthlyCents),
  );
  const receivableCents = sum(
    (input.debts ?? []).filter((debt) => !debt.settledOn).map((debt) => debt.amountCents),
  );

  return {
    month,
    incomeCents,
    primaryIncomeCents,
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
    composition: buildComposition({
      incomeCents,
      personalCents: Math.max(0, committedCents - housingCents),
      houseCents: housingCents,
      reservedCents,
      receivableCents,
    }),
    housingCents,
    housingBills,
    housingRatioPct,
    housingRatioPrimaryPct,
    ceilingPct: input.ceilingPct,
    overCeiling: housingRatioPct > input.ceilingPct,
    goals,
  };
}