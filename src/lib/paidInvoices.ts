import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

const SETTING = "invoices_paid";
const EVENT = "trove:invoices";

/** Which card invoices were marked as paid, kept as "cardId:YYYY-MM" keys in the settings. */
export function usePaidInvoices() {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    const read = () => {
      api
        .getSetting(SETTING)
        .then((value) => setKeys(value ? (JSON.parse(value) as string[]) : []))
        .catch(() => {});
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);

  const isPaid = useCallback((cardId: number, month: string) => keys.includes(`${cardId}:${month}`), [keys]);

  const setPaid = useCallback(
    (cardId: number, month: string, paid: boolean) => {
      const key = `${cardId}:${month}`;
      const next = paid ? [...keys.filter((entry) => entry !== key), key] : keys.filter((entry) => entry !== key);
      setKeys(next);
      void api
        .setSetting(SETTING, JSON.stringify(next))
        .then(() => window.dispatchEvent(new Event(EVENT)))
        .catch(() => {});
    },
    [keys],
  );

  return { isPaid, setPaid };
}
