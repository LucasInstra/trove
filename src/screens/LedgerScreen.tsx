import type { Category, MonthTotals, TransactionRow } from "../lib/api";
import { formatCents, formatDate, formatSignedCents, monthLabel } from "../lib/format";

interface LedgerScreenProps {
  rows: TransactionRow[];
  categories: Category[];
  totals: MonthTotals | null;
  month: string;
  search: string;
  loading: boolean;
  onSearch: (value: string) => void;
  onCategory: (transactionId: number, categoryId: number | null) => void;
  onImport: () => void;
}

export function LedgerScreen({
  rows,
  categories,
  totals,
  month,
  search,
  loading,
  onSearch,
  onCategory,
  onImport,
}: LedgerScreenProps) {
  const income = totals?.incomeCents ?? 0;
  const expense = totals?.expenseCents ?? 0;
  const result = income - expense;

  return (
    <section className="screen">
      <header className="screen-head">
        <div>
          <h1>Extrato</h1>
          <p className="muted">{monthLabel(month)}</p>
        </div>
        <button type="button" className="primary" onClick={onImport}>
          Importar extrato
        </button>
      </header>

      <div className="cards">
        <article className="card">
          <span>Entradas</span>
          <strong className="positive">{formatCents(income)}</strong>
        </article>
        <article className="card">
          <span>Saídas</span>
          <strong className="negative">{formatCents(expense)}</strong>
        </article>
        <article className="card">
          <span>Resultado</span>
          <strong className={result < 0 ? "negative" : "positive"}>{formatSignedCents(result)}</strong>
        </article>
        <article className="card">
          <span>Lançamentos</span>
          <strong>{totals?.transactionCount ?? 0}</strong>
        </article>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar por descrição, estabelecimento ou categoria"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      {loading ? <p className="muted">Carregando...</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="empty">
          <h2>Nenhum lançamento ainda</h2>
          <p className="muted">
            Importe o arquivo OFX que o seu banco oferece. Nada sai deste computador.
          </p>
          <button type="button" className="primary" onClick={onImport}>
            Escolher arquivo
          </button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Lançamento</th>
                <th>Conta</th>
                <th>Categoria</th>
                <th className="right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="nowrap muted">{formatDate(row.postedOn)}</td>
                  <td>
                    <strong>{row.merchant || row.description}</strong>
                    {row.merchant && row.merchant !== row.description ? (
                      <span className="sub">{row.description}</span>
                    ) : null}
                  </td>
                  <td className="muted nowrap">{row.accountName}</td>
                  <td>
                    <select
                      className="category"
                      value={row.categoryId ?? ""}
                      onChange={(event) =>
                        onCategory(
                          row.id,
                          event.target.value === "" ? null : Number(event.target.value),
                        )
                      }
                      style={
                        row.categoryColor ? { borderColor: row.categoryColor } : undefined
                      }
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={row.amountCents < 0 ? "right negative" : "right positive"}>
                    {formatSignedCents(row.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
