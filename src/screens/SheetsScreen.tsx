import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BudgetCharts } from "../components/BudgetCharts";
import { BudgetSheet } from "../components/BudgetSheet";
import { TransactionsCharts } from "../components/TransactionsSheet";
import type { Bill, BillInput, BillPayment, IncomeInput, Share, Holding, HoldingInput, Income, Person, TransactionRow } from "../lib/api";
import { useLanguage } from "../lib/language";
import { InvestmentsCharts, InvestmentsSheet } from "./InvestmentsSheet";

export type SheetTab = "investments" | "spending" | "charts";

/**
 * true: each tab shows its own charts below the sheet and the separate Charts tab is gone.
 * false: the charts of both live together in the Charts tab.
 */
const CHARTS_INLINE = true;

const TABS: SheetTab[] = CHARTS_INLINE ? ["spending", "investments"] : ["spending", "investments", "charts"];

/**
 * The spreadsheet mode in one place: the investments grid, the month's
 * entries grid and a tab with the charts of both. The ordinary screens keep
 * their cards and lists.
 */
export function SheetsScreen({
  month,
  tab,
  onTab,
  people,
  onAddPerson,
  holdings,
  onSaveHolding,
  onDeleteHolding,
  rows,
  onEditEntry,
  onTogglePending,
  incomes,
  bills,
  payments,
  partnerMode,
  onPartnerMode,
  shares,
  onAssignBill,
  order,
  onOrder,
  onTogglePaid,
  onSaveIncome,
  onEditIncome,
  onSaveBill,
  onEditBill,
}: {
  /** The month shown in the top bar, as YYYY-MM. */
  month: string;
  tab: SheetTab;
  onTab: (tab: SheetTab) => void;
  people: Person[];
  onAddPerson: (name: string) => void;
  holdings: Holding[];
  onSaveHolding: (input: HoldingInput) => void;
  onDeleteHolding: (id: number) => void;
  rows: TransactionRow[];
  onEditEntry: (entry: TransactionRow) => void;
  onTogglePending: (id: number, pending: boolean) => void;
  incomes: Income[];
  bills: Bill[];
  payments: BillPayment[];
  partnerMode: boolean;
  onPartnerMode: (on: boolean) => void;
  shares: Share[];
  onAssignBill: (billId: number, personId: number) => void;
  order: { bills: number[]; incomes: number[] };
  onOrder: (kind: "bills" | "incomes", ids: number[]) => void;
  onTogglePaid: (billId: number, paid: boolean) => void;
  onSaveIncome: (input: IncomeInput) => void;
  onEditIncome: (income: Income) => void;
  onSaveBill: (input: BillInput) => void;
  onEditBill: (bill: Bill) => void;
}) {
  const { t } = useLanguage();
  // The pills live in the top bar, beside the month; inline only if the bar is not there.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("topbar-slot")), []);
  const [extra, setExtra] = useState<HTMLElement | null>(null);
  useEffect(() => setExtra(document.getElementById("topbar-extra")), []);
  // On a phone-sized window the top bar stays one row, so the pills go inline instead.
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const [partnerName, setPartnerName] = useState("");

  const tabs = (
    <div className="segmented wide sheet-tabs" role="tablist" aria-label={t("nav.sheets")}>
      {TABS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          className={tab === id ? "active" : undefined}
          onClick={() => onTab(id)}
        >
          {t(`sheets.tab_${id}`)}
        </button>
      ))}
    </div>
  );

  const toggle = (
    <>
      {tab === "spending" ? (
        <div className="partner-toggle">
          <label className="switch-row" title={t("budget.partnerHint")}>
            <input type="checkbox" checked={partnerMode} onChange={(event) => onPartnerMode(event.target.checked)} />
            <span className="partner-label">{t("budget.partnerMode")}</span>
          </label>
          {partnerMode && people.length < 2 ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const name = partnerName.trim();
                if (!name) return;
                onAddPerson(name);
                setPartnerName("");
              }}
            >
              <input value={partnerName} maxLength={40} placeholder={t("budget.partnerName")} aria-label={t("budget.partnerName")} onChange={(event) => setPartnerName(event.target.value)} />
              <button type="submit" className="primary" disabled={!partnerName.trim()}>
                {t("people.add")}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <section className="screen planner-screen sheets-screen">
      {slot && wide ? createPortal(tabs, slot) : tabs}
      {extra && wide ? createPortal(toggle, extra) : toggle}

      {tab === "investments" ? (
        <>
          {CHARTS_INLINE ? <InvestmentsCharts holdings={holdings} month={month} part="stats" /> : null}
          <InvestmentsSheet month={month} people={people} holdings={holdings} onSave={onSaveHolding} onDelete={onDeleteHolding} />
          {CHARTS_INLINE ? <InvestmentsCharts holdings={holdings} month={month} part="charts" /> : null}
        </>
      ) : null}
      {tab === "spending" ? (
        <>
        <BudgetSheet
          month={month}
          incomes={incomes}
          entries={rows}
          onEditEntry={onEditEntry}
          onTogglePending={onTogglePending}
          bills={bills}
          payments={payments}
          people={people}
          shares={shares}
          partnerMode={partnerMode}
          onAssignBill={onAssignBill}
          order={order}
          onOrder={onOrder}
          onTogglePaid={onTogglePaid}
          onSaveIncome={onSaveIncome}
          onEditIncome={onEditIncome}
          onSaveBill={onSaveBill}
          onEditBill={onEditBill}
        />
          {partnerMode ? <BudgetCharts month={month} people={people} incomes={incomes} bills={bills} payments={payments} shares={shares} /> : null}
          {CHARTS_INLINE ? <TransactionsCharts rows={rows} /> : null}
        </>
      ) : null}
      {tab === "charts" ? (
        <>
          <h2 className="sheet-section">{t("sheets.tab_investments")}</h2>
          <InvestmentsCharts holdings={holdings} month={month} />
          <h2 className="sheet-section">{t("sheets.tab_spending")}</h2>
          <TransactionsCharts rows={rows} />
        </>
      ) : null}
    </section>
  );
}
