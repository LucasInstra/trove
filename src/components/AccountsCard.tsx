import type { AccountRow } from "../domain/accounts";
import { totalBalanceKnown, totalHeldCents, totalMonthCents, totalOwedCents } from "../domain/accounts";
import { formatCents } from "../lib/format";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";
import { IconBubble } from "./editorial";
import { Money } from "./Money";

const signed = (cents: number) => (cents > 0 ? `+${formatCents(cents)}` : formatCents(cents));

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
                  <span className="accounts-figures">
                    <span className={row.monthCents < 0 ? "accounts-value neg" : "accounts-value"}>
                      {signed(row.monthCents)}
                    </span>
                    {row.hasOpening ? (
                      <small className="muted">{t("accounts.balanceOf", { amount: formatCents(row.balanceCents) })}</small>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <footer className="accounts-total">
            <span>{t("accounts.monthResult")}</span>
            <strong>{signed(totalMonthCents(rows))}</strong>
          </footer>
          {totalBalanceKnown(rows) ? (
            <p className="accounts-balance-line">
              <span>{t("accounts.heldTotal")}</span>
              <strong>
                <Money cents={totalHeldCents(rows)} />
              </strong>
            </p>
          ) : null}
          {owed > 0 ? (
            <p className="muted small">{t("accounts.owed", { amount: formatCents(owed) })}</p>
          ) : null}
        </>
      )}
    </article>
  );
}
