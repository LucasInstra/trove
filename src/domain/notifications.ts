import type { CardMeta } from "../lib/api";
import type { InvoiceWindow } from "./invoice";
import type { MonthPlan } from "./projection";

export interface PlanNotification {
  key: string;
  kind: "late" | "soon" | "card" | "setup";
  messageKey: string;
  vars: Record<string, string | number>;
}

export interface NotificationInput {
  plan: MonthPlan;
  cards: { meta: CardMeta; window: InvoiceWindow }[];
  today: string;
  reads: string[];
  hasIncome: boolean;
}

const daysUntil = (day: number, today: string): number => {
  const now = Number(today.slice(8, 10));
  return day - now;
};

/**
 * Everything here is derived from the plan. Nothing is stored except the read
 * keys, so a notification cannot outlive the fact that produced it.
 */
export function buildNotifications(input: NotificationInput): PlanNotification[] {
  const { plan, today, reads } = input;
  const currentMonth = today.slice(0, 7);
  const out: PlanNotification[] = [];

  if (plan.month === currentMonth) {
    for (const bill of plan.dueBills) {
      if (plan.paidBillIds.includes(bill.id)) continue;
      const delta = daysUntil(bill.dueDay, today);
      if (delta < 0) {
        out.push({
          key: `bill:${bill.id}:${plan.month}:late`,
          kind: "late",
          messageKey: "notify.late",
          vars: { name: bill.name, day: bill.dueDay },
        });
      } else if (delta <= 3) {
        out.push({
          key: `bill:${bill.id}:${plan.month}:soon`,
          kind: "soon",
          messageKey: "notify.soon",
          vars: { name: bill.name, day: bill.dueDay },
        });
      }
    }

    for (const { meta, window } of input.cards) {
      const delta = daysUntil(Number(window.to.slice(8, 10)), today);
      if (window.to.slice(0, 7) === currentMonth && delta >= 0 && delta <= 3) {
        out.push({
          key: `card:${meta.id}:${plan.month}:closing`,
          kind: "card",
          messageKey: "notify.card",
          vars: { name: meta.accountName, day: Number(window.to.slice(8, 10)) },
        });
      }
    }
  }

  if (!input.hasIncome) {
    out.push({
      key: "plan:no-income",
      kind: "setup",
      messageKey: "notify.noIncome",
      vars: {},
    });
  }

  return out.filter((item) => !reads.includes(item.key));
}
