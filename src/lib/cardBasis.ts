import { api, type CardMeta } from "./api";
import { LEDGER_EVENT } from "./paidInvoices";

function save(meta: CardMeta, on: boolean) {
  return api.saveCard({
    id: meta.id,
    accountId: meta.accountId,
    brand: meta.brand,
    last4: meta.last4,
    limitCents: meta.limitCents,
    closingDay: meta.closingDay,
    dueDay: meta.dueDay,
    color: meta.color,
    texture: meta.texture,
    cashBasis: on,
  });
}

/** Turns cash basis on or off for one card and reloads every screen that counts its purchases. */
export async function setCashBasis(meta: CardMeta, on: boolean): Promise<void> {
  await save(meta, on);
  window.dispatchEvent(new Event(LEDGER_EVENT));
}

/** The general switch on the Cards screen: the same choice for every card, one reload. */
export async function setCashBasisAll(cards: CardMeta[], on: boolean): Promise<void> {
  for (const meta of cards) if (meta.cashBasis !== on) await save(meta, on);
  window.dispatchEvent(new Event(LEDGER_EVENT));
}
