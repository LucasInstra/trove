import type { Translate } from "./i18n";

/** Backend messages are English text; the ones the screens can trigger get a translated line. */
const KNOWN: Array<[RegExp, string]> = [
  [/holding name must not be empty/, "errors.holdingNameEmpty"],
  [/holding name is too long/, "errors.holdingNameLong"],
  [/holding amount must not be negative/, "errors.holdingAmount"],
  [/holding cost must not be negative/, "errors.holdingCost"],
  [/holding rate is out of range/, "errors.holdingRate"],
  [/holding term is out of range/, "errors.holdingTerm"],
  [/holding (owner|institution|product|notes) is too long/, "errors.holdingTooLong"],
  [/holding maturity is before its start/, "errors.holdingMaturity"],
  [/holding (\d+ )?does not exist/, "errors.holdingMissing"],
  [/a holding with this name already exists/, "errors.holdingDuplicate"],
  [/(income|bill|goal) name must not be empty/, "errors.nameEmpty"],
  [/(income|bill|goal|card brand) (name )?is too long/, "errors.nameLong"],
  [/(income|bill|card|goal) .*must not be negative/, "errors.amountNegative"],
  [/(pay|due|closing) day must be between 1 and 31/, "errors.dayRange"],
  [/bill end date is before its start/, "errors.billEndBeforeStart"],
  [/card last4 must be up to 4 digits/, "errors.cardLast4"],
  [/this account already has a card/, "errors.cardAccountTaken"],
];

/**
 * Known messages get their own line. Any other backend message is English text, so in Portuguese it
 * is wrapped in a Portuguese sentence and kept in parentheses for support.
 */
export function localizeError(message: string, t: Translate, lang: string): string {
  for (const [pattern, key] of KNOWN) if (pattern.test(message)) return t(key);
  return lang === "pt" ? `${t("errors.generic")} (${message})` : message;
}
