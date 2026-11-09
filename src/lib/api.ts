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

export interface ImportReport {
  accountId: number;
  accountName: string;
  accountLabel: string;
  inserted: number;
  duplicates: number;
  ledgerBalanceCents: number | null;
  ledgerBalanceOn: string | null;
}

export const api = {
  importOfx: (path: string) => invoke<ImportReport>("import_ofx", { path }),
  accounts: () => invoke<Account[]>("list_accounts"),
  categories: () => invoke<Category[]>("list_categories"),
  transactions: (search?: string, limit = 500) =>
    invoke<TransactionRow[]>("list_transactions", { search: search ?? null, limit }),
  setCategory: (transactionId: number, categoryId: number | null) =>
    invoke<void>("set_category", { transactionId, categoryId }),
  monthTotals: (month: string) => invoke<MonthTotals>("month_totals", { month }),
  databaseLocation: () => invoke<string>("database_location"),
};
