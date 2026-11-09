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
}

export interface MonthPoint {
  month: string;
  incomeCents: number;
  expenseCents: number;
}

export interface ImportReport {
  accountId: number;
  accountName: string;
  accountLabel: string;
  inserted: number;
  duplicates: number;
  ledgerBalanceCents: number | null;
  ledgerBalanceOn: string | null;
}

export interface ImportRow {
  id: number;
  path: string;
  accountName: string;
  importedAt: string;
  inserted: number;
  duplicates: number;
}

export const api = {
  importOfx: (path: string) => invoke<ImportReport>("import_ofx", { path }),
  accounts: () => invoke<Account[]>("list_accounts"),
  categories: () => invoke<Category[]>("list_categories"),
  transactions: (search?: string, month?: string, limit = 500) =>
    invoke<TransactionRow[]>("list_transactions", {
      search: search ?? null,
      month: month ?? null,
      limit,
    }),
  categoryTotals: (month: string) => invoke<CategoryTotal[]>("category_totals", { month }),
  monthSeries: (month: string, count = 6) =>
    invoke<MonthPoint[]>("month_series", { month, count }),
  latestMonth: () => invoke<string | null>("latest_month"),
  imports: (limit = 12) => invoke<ImportRow[]>("list_imports", { limit }),
  setCategory: (transactionId: number, categoryId: number | null) =>
    invoke<void>("set_category", { transactionId, categoryId }),
  monthTotals: (month: string) => invoke<MonthTotals>("month_totals", { month }),
  databaseLocation: () => invoke<string>("database_location"),
};
