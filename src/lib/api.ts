import { invoke } from "@tauri-apps/api/core";

export interface Account {
  id: number;
  name: string;
  kind: string;
  bankId: string;
  acctId: string;
  currency: string;
}

export interface Category {
  id: number;
  name: string;
  kind: string;
  color: string;
  parentId: number | null;
  emoji: string;
  sortOrder: number;
  archivedAt: string | null;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Holding {
  id: number;
  name: string;
  kind: "cash" | "investment" | "property" | "other";
  amountCents: number;
  updatedOn: string;
  /** What was put in; 0 when unknown. */
  costCents: number;
}

export interface HoldingInput {
  id?: number | null;
  name: string;
  kind: "cash" | "investment" | "property" | "other";
  amountCents: number;
  updatedOn: string;
  costCents?: number;
}

export interface TransactionRow {
  id: number;
  accountId: number;
  accountName: string;
  postedOn: string;
  amountCents: number;
  description: string;
  merchant: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  trntype: string;
  manual: boolean;
  notes: string;
  origin: string;
  transferGroup: string | null;
  refundOf: number | null;
  hasRefund: boolean;
  tags: Tag[];
}

export interface CategoryMonth {
  month: string;
  categoryId: number | null;
  name: string;
  color: string;
  totalCents: number;
}

export interface ManualInput {
  accountId: number;
  postedOn: string;
  amountCents: number;
  description: string;
  categoryId: number | null;
  notes: string;
}

export interface ManualEdit extends ManualInput {
  id: number;
}

export interface TransferInput {
  fromAccountId: number;
  toAccountId: number;
  postedOn: string;
  amountCents: number;
  description: string;
  notes: string;
}

export interface RefundInput {
  originalId: number;
  postedOn?: string | null;
  notes?: string | null;
}

export interface Rule {
  id: number;
  pattern: string;
  target: "merchant" | "description" | "both";
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  sign: "any" | "in" | "out";
  minAmountCents: number | null;
  maxAmountCents: number | null;
  priority: number;
}

export interface RuleInput {
  id?: number | null;
  pattern: string;
  target: "merchant" | "description" | "both";
  categoryId: number;
  sign: "any" | "in" | "out";
  minAmountCents: number | null;
  maxAmountCents: number | null;
  priority: number;
}

export interface BudgetLine {
  categoryId: number | null;
  name: string;
  color: string;
  limitCents: number;
  overridden: boolean;
  carryover: boolean;
  carryInCents: number;
  effectiveCents: number;
  spentCents: number;
}

export interface BudgetStatus {
  month: string;
  global: BudgetLine | null;
  lines: BudgetLine[];
}

export interface BudgetLimitInput {
  month: string;
  categoryId: number | null;
  limitCents: number | null;
  carryover: boolean;
}

export interface RecurrenceRow {
  postedOn: string;
  merchant: string;
  description: string;
  amountCents: number;
}

export interface DailyPoint {
  day: string;
  incomeCents: number;
  expenseCents: number;
}

export interface CategoryInput {
  id: number | null;
  name: string;
  kind: string;
  color: string;
  parentId: number | null;
  emoji: string;
  sortOrder: number;
}

export interface ClearReport {
  manualDeleted: number;
  paymentsCleared: number;
}

export interface MonthTotals {
  month: string;
  incomeCents: number;
  expenseCents: number;
  transactionCount: number;
}

export interface CategoryTotal {
  categoryId: number | null;
  name: string;
  color: string;
  totalCents: number;
  budgetCents: number | null;
}

export interface MonthPoint {
  month: string;
  incomeCents: number;
  expenseCents: number;
}

export interface ImportReport {  accountId: number;
  accountName: string;
  accountLabel: string;
  inserted: number;
  duplicates: number;
  skipped: number;
  categorized: number;
  ledgerBalanceCents: number | null;
  ledgerBalanceOn: string | null;
}

export interface CsvMapping {
  separator: string;
  encoding: string;
  hasHeader: boolean;
  dateCol: number;
  dateFormat: string;
  descriptionCol: number;
  amountCol: number | null;
  debitCol: number | null;
  creditCol: number | null;
  decimalSep: string;
}

export interface CsvRow {
  lineNo: number;
  postedOn: string;
  description: string;
  amountCents: number;
}

export interface CsvIssue {
  lineNo: number;
  message: string;
}

export interface CsvPreview {
  rows: CsvRow[];
  issues: CsvIssue[];
}

export interface CsvProfile extends CsvMapping {
  id: number;
  name: string;
}

export interface CsvProfileInput extends CsvMapping {
  id?: number | null;
  name: string;
}

export interface ImportRow {
  id: number;
  path: string;
  accountName: string;
  importedAt: string;
  inserted: number;
  duplicates: number;
}

export interface Income {
  id: number;
  name: string;
  amountCents: number;
  frequency: string;
  payDay: number;
  accountId: number | null;
  active: boolean;
}

export interface Bill {
  id: number;
  name: string;
  amountCents: number;
  dueDay: number;
  frequency: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: number | null;
  goalId: number | null;
  startsOn: string;
  endsOn: string | null;
  installmentsTotal: number | null;
  active: boolean;
}

export interface BillPayment {
  id: number;
  billId: number;
  month: string;
  paidOn: string;
  amountCents: number;
}

export interface CardMeta {
  id: number;
  accountId: number;
  accountName: string;
  brand: string;
  last4: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  color: string;
  texture: string;
}

export interface Goal {
  id: number;
  name: string;
  kind: string;
  targetCents: number;
  monthlyCents: number;
  startsOn: string;
  accountId: number | null;
  color: string;
  icon: string;
}

export interface GoalTotal {
  goalId: number;
  paidCents: number;
  payments: number;
}

export interface Person {
  id: number;
  name: string;
  color: string;
  isSelf: boolean;
  weightPct: number;
  incomeCents: number;
}

export interface PersonInput {
  id: number;
  name: string;
  incomeCents: number;
}

export interface Share {
  billId: number;
  personId: number;
}

export interface ShareInput {
  billId: number;
  personId: number;
}

export interface Debt {
  id: number;
  personId: number;
  personName: string | null;
  label: string;
  amountCents: number;
  month: string;
  settledOn: string | null;
}

export interface DebtInput {
  id: number | null;
  personId: number;
  label: string;
  amountCents: number;
  month: string;
}

export interface DepositInput {
  id: number | null;
  goalId: number;
  amountCents: number;
  depositedOn: string;
}

export interface PlannerState {
  incomes: Income[];
  bills: Bill[];
  payments: BillPayment[];
  cards: CardMeta[];
  goals: Goal[];
  goalTotals: GoalTotal[];
  reads: string[];
  people: Person[];
  shares: Share[];
  debts: Debt[];
}

export interface IncomeInput {
  id: number | null;
  name: string;
  amountCents: number;
  frequency: string;
  payDay: number;
  accountId: number | null;
  active: boolean;
}

export interface BillInput {
  id: number | null;
  name: string;
  amountCents: number;
  dueDay: number;
  frequency: string;
  categoryId: number | null;
  accountId: number | null;
  goalId: number | null;
  startsOn: string;
  endsOn: string | null;
  installmentsTotal: number | null;
  active: boolean;
}

export interface CardInput {
  id: number | null;
  accountId: number;
  brand: string;
  last4: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  color: string;
  texture: string;
}

export interface GoalInput {
  id: number | null;
  name: string;
  kind: string;
  targetCents: number;
  monthlyCents: number;
  startsOn: string;
  accountId: number | null;
  color: string;
  icon?: string;
}

export const EMPTY_PLANNER: PlannerState = {
  incomes: [],
  bills: [],
  payments: [],
  cards: [],
  goals: [],
  goalTotals: [],
  reads: [],
  people: [],
  shares: [],
  debts: [],
};

export const api = {
  importOfx: (path: string) => invoke<ImportReport>("import_ofx", { path }),
  previewCsv: (path: string, mapping: CsvMapping) =>
    invoke<CsvPreview>("preview_csv", { path, mapping }),
  importCsv: (path: string, accountId: number, mapping: CsvMapping) =>
    invoke<ImportReport>("import_csv", { path, accountId, mapping }),
  csvProfiles: () => invoke<CsvProfile[]>("list_csv_profiles"),
  saveCsvProfile: (input: CsvProfileInput) =>
    invoke<number>("save_csv_profile", { input }),
  deleteCsvProfile: (id: number) => invoke<void>("delete_csv_profile", { id }),
  exportCsv: (
    path: string,
    search?: string,
    month?: string,
    accountId?: number | null,
    tagId?: number | null,
  ) =>
    invoke<number>("export_csv", {
      path,
      search: search ?? null,
      month: month ?? null,
      accountId: accountId ?? null,
      tagId: tagId ?? null,
    }),
  accounts: () => invoke<Account[]>("list_accounts"),
  categories: () => invoke<Category[]>("list_categories"),
  transactions: (
    search?: string,
    month?: string,
    accountId?: number | null,
    limit = 500,
    tagId?: number | null,
  ) =>
    invoke<TransactionRow[]>("list_transactions", {
      search: search ?? null,
      month: month ?? null,
      accountId: accountId ?? null,
      limit,
      tagId: tagId ?? null,
    }),
  tags: () => invoke<Tag[]>("list_tags"),
  saveTag: (name: string) => invoke<number>("save_tag", { name }),
  deleteTag: (id: number) => invoke<void>("delete_tag", { id }),
  bulkSetCategory: (ids: number[], categoryId: number | null) =>
    invoke<number>("bulk_set_category", { ids, categoryId }),
  bulkTag: (ids: number[], tagId: number, assign: boolean) =>
    invoke<number>("bulk_tag", { ids, tagId, assign }),
  holdings: () => invoke<Holding[]>("list_holdings"),
  saveHolding: (input: HoldingInput) => invoke<number>("save_holding", { input }),
  deleteHolding: (id: number) => invoke<void>("delete_holding", { id }),
  categoryTotals: (month: string) => invoke<CategoryTotal[]>("category_totals", { month }),
  monthSeries: (month: string, count = 6) =>
    invoke<MonthPoint[]>("month_series", { month, count }),
  latestMonth: () => invoke<string | null>("latest_month"),
  imports: (limit = 12) => invoke<ImportRow[]>("list_imports", { limit }),
  setCategory: (transactionId: number, categoryId: number | null) =>
    invoke<void>("set_category", { transactionId, categoryId }),
  setCategoryBudget: (categoryId: number, budgetCents: number | null) =>
    invoke<void>("set_category_budget", { categoryId, budgetCents }),
  saveManual: (input: ManualInput) => invoke<number>("save_manual_transaction", { input }),
  updateManual: (input: ManualEdit) => invoke<void>("update_manual_transaction", { input }),
  deleteManual: (id: number) => invoke<void>("delete_manual_transaction", { id }),
  saveTransfer: (input: TransferInput) => invoke<string>("save_transfer", { input }),
  deleteTransfer: (id: number) => invoke<void>("delete_transfer", { id }),
  saveRefund: (input: RefundInput) => invoke<number>("save_refund", { input }),
  saveRule: (input: RuleInput) => invoke<number>("save_rule", { input }),
  deleteRule: (id: number) => invoke<void>("delete_rule", { id }),
  listRules: () => invoke<Rule[]>("list_rules"),
  applyRules: () => invoke<number>("apply_rules"),
  budgetStatus: (month: string) => invoke<BudgetStatus>("budget_status", { month }),
  saveBudgetLimit: (input: BudgetLimitInput) => invoke<void>("save_budget_limit", { input }),
  recurrenceRows: (endMonth: string, count = 12) =>
    invoke<RecurrenceRow[]>("recurrence_rows", { endMonth, count }),
  dailyExpense: (month: string) => invoke<DailyPoint[]>("daily_expense", { month }),
  createManualAccount: (name: string) => invoke<number>("create_manual_account", { name }),
  renameAccount: (id: number, name: string) => invoke<void>("rename_account", { id, name }),
  archiveAccount: (id: number) => invoke<void>("archive_account", { id }),
  saveCategory: (input: CategoryInput) => invoke<number>("save_category", { input }),
  deleteCategory: (id: number) => invoke<void>("delete_category", { id }),
  archiveCategory: (id: number, archived: boolean) =>
    invoke<void>("archive_category", { id, archived }),
  clearMonth: (month: string) => invoke<ClearReport>("clear_month", { month }),
  categoryMonthSeries: (endMonth: string, count = 6) =>
    invoke<CategoryMonth[]>("category_month_series", { endMonth, count }),
  monthTotals: (month: string) => invoke<MonthTotals>("month_totals", { month }),
  databaseLocation: () => invoke<string>("database_location"),
  backupDatabase: (path: string) => invoke<void>("backup_database", { path }),
  restoreDatabase: (path: string) => invoke<void>("restore_database", { path }),

  plannerState: (month: string) => invoke<PlannerState>("planner_state", { month }),
  saveIncome: (input: IncomeInput) => invoke<number>("save_income", { input }),
  deleteIncome: (id: number) => invoke<void>("delete_income", { id }),
  saveBill: (input: BillInput) => invoke<number>("save_bill", { input }),
  deleteBill: (id: number) => invoke<void>("delete_bill", { id }),
  setBillPaid: (billId: number, month: string, paid: boolean) =>
    invoke<void>("set_bill_paid", { billId, month, paid }),
  saveCard: (input: CardInput) => invoke<number>("save_card", { input }),
  deleteCard: (id: number) => invoke<void>("delete_card", { id }),
  loadDemoData: () => invoke<void>("load_demo_data"),
  demoLoaded: () => invoke<boolean>("demo_loaded"),
  reorderCards: (ids: number[]) => invoke<void>("reorder_cards", { ids }),
  saveGoal: (input: GoalInput) => invoke<number>("save_goal", { input }),
  cardUsage: (accountId: number, from: string, to: string) =>
    invoke<number>("card_usage", { accountId, from, to }),
  setShare: (input: ShareInput) => invoke<void>("set_share", { input }),
  savePerson: (input: PersonInput) => invoke<void>("save_person", { input }),
  saveDebt: (input: DebtInput) => invoke<number>("save_debt", { input }),
  deleteDebt: (id: number) => invoke<void>("delete_debt", { id }),
  setDebtSettled: (id: number, settled: boolean) =>
    invoke<void>("set_debt_settled", { id, settled }),
  saveDeposit: (input: DepositInput) => invoke<number>("save_deposit", { input }),
  markNotificationsRead: (keys: string[]) =>
    invoke<void>("mark_notifications_read", { keys }),
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
};
