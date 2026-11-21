import { cashDate } from "../domain/invoice";
import { useLanguage } from "../lib/language";

/**
 * A worked example with this card's own days: a purchase made today, the invoice it lands in,
 * and the month it counts in, with the option on or off.
 */
export function CashBasisNote({ closingDay, dueDay, on }: { closingDay: number; dueDay: number; on: boolean }) {
  const { lang, t } = useLanguage();
  if (!(closingDay >= 1 && closingDay <= 31 && dueDay >= 1 && dueDay <= 31)) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const due = cashDate(today, closingDay, dueDay);
  const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const monthName = (iso: string) =>
    new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { month: "long" }).format(new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1));
  const values = { today: short(today), due: short(due), counts: monthName(on ? due : today), other: monthName(on ? today : due) };
  return (
    <small className="cash-basis-note">
      {t(on ? "planner.cashBasisOnLine" : "planner.cashBasisOffLine", values)
        .split("**")
        .map((part, index) => (index % 2 ? <b key={index}>{part}</b> : part))}
    </small>
  );
}
