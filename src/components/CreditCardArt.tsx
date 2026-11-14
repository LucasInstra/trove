import type { CSSProperties } from "react";
import type { CardMeta } from "../lib/api";
import { bankByTexture, bankForName, type Bank } from "../domain/cardDesigns";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

/** The bank a card belongs to: its saved look first, then what its account name says. */
function bankOf(meta: CardMeta): Bank | null {
  return bankByTexture(meta.texture) ?? bankForName(`${meta.accountName} ${meta.brand}`.toLowerCase());
}

type Network = "mastercard" | "visa" | "elo" | "amex" | "hipercard";

function networkOf(brand: string): Network | null {
  const text = brand.toLowerCase();
  if (/master/.test(text)) return "mastercard";
  if (/visa/.test(text)) return "visa";
  if (/\belo\b/.test(text)) return "elo";
  if (/amex|american/.test(text)) return "amex";
  if (/hiper/.test(text)) return "hipercard";
  return null;
}

/**
 * Simplified marks drawn for the card: a styled name for the bank, and the card network in
 * the corner where it is printed on a real card. Not the official artwork.
 */
export function BankMark({ bank }: { bank: Bank }) {
  const label: Record<string, string> = {
    nubank: "nu",
    itau: "itaú",
    santander: "Santander",
    bradesco: "Bradesco",
    caixa: "CAIXA",
    inter: "inter",
    picpay: "PicPay",
    c6: "C6 BANK",
    bb: "BB",
    mp: "mercado pago",
    xp: "xp",
  };
  return (
    <span className={`bank-mark bank-${bank.id}`} aria-hidden="true">
      {bank.id === "santander" ? (
        <svg width="14" height="16" viewBox="0 0 14 16">
          <path d="M7 0c1 3.5 5.5 5.6 5.5 9.2A5.5 5.5 0 0 1 7 14.7 5.5 5.5 0 0 1 1.5 9.2C1.5 7 3 5.8 4 4.4c.6 1.3 1.5 1.9 2.2 1.9C6.2 4.1 6.4 2 7 0Z" fill="currentColor" />
        </svg>
      ) : null}
      {label[bank.id] ?? bank.name}
    </span>
  );
}

function NetworkMark({ network }: { network: Network }) {
  if (network === "mastercard") {
    return (
      <svg className="network-mark" width="38" height="24" viewBox="0 0 38 24" aria-hidden="true">
        <circle cx="13" cy="12" r="11" fill="#eb001b" />
        <circle cx="25" cy="12" r="11" fill="#f79e1b" />
        <path d="M19 3.1a11 11 0 0 1 0 17.8 11 11 0 0 1 0-17.8Z" fill="#ff5f00" />
      </svg>
    );
  }
  return (
    <span className={`network-mark network-${network}`} aria-hidden="true">
      {network === "hipercard" ? "Hipercard" : network === "amex" ? "AMEX" : network}
    </span>
  );
}

/** A card drawn like the real thing: chip, number, holder and the two dates. */
export function CreditCardArt({ meta, status }: { meta: CardMeta; status?: string }) {
  const { t } = useLanguage();
  const gradient = `chip-art-${meta.id}`;
  const bank = bankOf(meta);
  const network = networkOf(meta.brand);
  return (
    <div
      className="card-art-real"
      data-texture={meta.texture || "plain"}
      style={{ "--card-color": meta.color } as CSSProperties}
      role="img"
      aria-label={`${meta.brand || t("planner.card")} •••• ${meta.last4 || "0000"}`}
    >
      <span className="card-art-top">
        {bank ? (
          <BankMark bank={bank} />
        ) : (
          <span className="card-art-brand">{meta.brand || t("planner.card")}</span>
        )}
        <span className="card-art-right">
          {status ? <span className="card-art-status">{status}</span> : null}
          <Icon name="contactless" size={20} strokeWidth={1.5} />
        </span>
      </span>

      <svg className="card-art-chip" width="40" height="30" viewBox="0 0 34 26" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6e3ab" />
            <stop offset="0.5" stopColor="#d9b86c" />
            <stop offset="1" stopColor="#b18f43" />
          </linearGradient>
        </defs>
        <rect width="34" height="26" rx="5" fill={`url(#${gradient})`} />
        <path
          d="M0 9h11M0 17h11M23 0v26M11 9h12v8H11z"
          fill="none"
          stroke="rgba(90, 66, 20, 0.45)"
          strokeWidth="1"
        />
      </svg>

      <span className="card-art-number">
        <i>••••</i>
        <i>••••</i>
        <i>••••</i>
        <b>{meta.last4 || "0000"}</b>
      </span>

      <span className="card-art-bottom">
        <span className="card-art-field">
          <em>{meta.accountName}</em>
          <small>
            {t("planner.closesDayShort", { day: meta.closingDay })} · {t("planner.dueDayShort", { day: meta.dueDay })}
          </small>
        </span>
        {network ? <NetworkMark network={network} /> : null}
      </span>
    </div>
  );
}
