import type { Account } from "../lib/api";
import { useLanguage } from "../lib/language";

/** Which account the recurring salary counts on. Only shown when there is a choice to make. */
export function SalaryAccount({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  const { t } = useLanguage();
  if (accounts.length < 2) return null;
  return (
    <label className="field salary-account">
      <span>{t("accounts.salaryAccount")}</span>
      <select value={value ?? ""} onChange={(event) => onChange(Number(event.target.value))}>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <small className="muted">{t("accounts.salaryAccountHint")}</small>
    </label>
  );
}
