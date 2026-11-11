import { TransactionsPanel } from "../components/TransactionsPanel";
import type { Account, Category, Tag, TransactionRow } from "../lib/api";

interface TransactionsScreenProps {
  rows: TransactionRow[];
  categories: Category[];
  tags: Tag[];
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
  onBulkCategory: (ids: number[], categoryId: number | null) => void;
  onBulkTag: (ids: number[], tagId: number, assign: boolean) => void;
  onNewTag: (name: string) => Promise<number | null>;
  onDeleteTag: (id: number) => void;
  month: string;
  groups: { day: string; rows: TransactionRow[]; total: number }[];
  accounts: Account[];
  accountFilter: number | null;
  onAccountFilter: (accountId: number | null) => void;
  tagFilter: number | null;
  onTagFilter: (tagId: number | null) => void;
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
