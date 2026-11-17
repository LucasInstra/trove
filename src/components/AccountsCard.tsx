import type { AccountRow } from "../domain/accounts";
import { totalHeldCents, totalOwedCents } from "../domain/accounts";
import { formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";
import { IconBubble } from "./editorial";
import { Money } from "./Money";

/** Every account with what it holds, and the total of the money you hold. */
export function AccountsCard({
  rows,
  activeId,
  onSelect,
  onManage,
}: {
  rows: AccountRow[];
  activeId: number | null;
  onSelect: (id: number | null) => void;
  onManage: () => void;
}) {
  const { t } = useLanguage();
  const owed = totalOwedCents(rows);
  return (
    <article className="card accounts-card">
      <header className="card-head">
        <div className="card-title">
          <IconBubble name="bank" size="sm" />
          <h2>{t("accounts.cardTitle")}</h2>
        </div>
        <button type="button" className="round-button static" onClick={onManage} aria-label={t("accounts.manage")} title={t("accounts.manage")}>
          <Icon name="settings" size={15} />
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="card-empty">{t("accounts.cardEmpty")}</p>
      ) : (
        <>
          <ul className="accounts-list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={activeId === row.id ? "accounts-row active" : "accounts-row"}
                  aria-pressed={activeId === row.id}
                  title={t("accounts.scopeOne", { name: row.name })}
                  onClick={() => onSelect(activeId === row.id ? null : row.id)}
                >
                  <span className="accounts-name">{row.name}</span>
                  <span className={row.balanceCents < 0 ? "accounts-value neg" : "accounts-value"}>
                    {formatCents(row.balanceCents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="accounts-total">
            <span>{t("accounts.heldTotal")}</span>
            <strong>
              <Money cents={totalHeldCents(rows)} />
            </strong>
          </footer>
          {owed > 0 ? (
            <p className="muted small">{t("accounts.owed", { amount: formatCents(owed) })}</p>
          ) : null}
        </>
      )}
    </article>
  );
}
