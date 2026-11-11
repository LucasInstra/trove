import { TransactionsPanel } from "../components/TransactionsPanel";
import type { Account, Category, TransactionRow } from "../lib/api";

interface TransactionsScreenProps {
  rows: TransactionRow[];
  categories: Category[];
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
  onClearMonth: () => void;
  onEditEntry: (entry: TransactionRow) => void;
  onDeleteEntry: (id: number) => void;
  onRefund: (id: number) => void;
  onNewTransfer: () => void;
  month: string;
  groups: { day: string; rows: TransactionRow[]; total: number }[];
  accounts: Account[];
  accountFilter: number | null;
  onAccountFilter: (accountId: number | null) => void;
}

/**
 * The ledger gets its own screen: on the dashboard it pushed the cards up and
 * turned the page into two unrelated things. It reuses the same panel.
 */
export function TransactionsScreen(props: TransactionsScreenProps) {
  return (
    <section className="screen transactions">
      <TransactionsPanel {...props} />
    </section>
  );
}
