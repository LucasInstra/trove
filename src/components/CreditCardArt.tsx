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
 * Simplified marks drawn for the card: a small glyph plus a styled name for the bank, and the
 * card network in the corner where it is printed on a real card. Not the official artwork.
 */
const BANK_LABEL: Record<string, string> = {
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
  brb: "BRB",
  safra: "Safra",
  sicredi: "Sicredi",
};

function BankGlyph({ id }: { id: string }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", "aria-hidden": true } as const;
  switch (id) {
    case "santander":
      return (
        <svg {...common}>
          <path d="M8 0c1.1 3.9 6 6.2 6 10.2A6 6 0 0 1 8 16a6 6 0 0 1-6-5.8C2 7.8 3.6 6.5 4.7 5 5.4 6.4 6.4 7 7.2 7 7.1 4.7 7.4 2.3 8 0Z" fill="currentColor" />
        </svg>
      );
    case "caixa":
      return (
        <svg {...common}>
          <path d="M2 2l12 12" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M14 2L2 14" stroke="#f39200" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );
    case "bradesco":
      return (
        <svg {...common}>
          <path d="M1 15V8a7 7 0 0 1 14 0v7h-4V8a3 3 0 0 0-6 0v7Z" fill="currentColor" />
        </svg>
      );
    case "picpay":
      return (
        <svg {...common}>
          <rect x="1" y="1" width="14" height="14" rx="4.5" fill="currentColor" />
          <path d="M6 12V4.500h2.600a2.4 2.4 0 1 1 0 4.800H6" fill="none" stroke="#11c76f" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "inter":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <circle cx="8" cy="8" r="3" fill="#ff7a00" />
        </svg>
      );
    case "mp":
      return (
        <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
          <ellipse cx="11" cy="8" rx="10" ry="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4.5 8.500c2 2 3.5 2 4.500.5l2-2 2.5 2.500c1 1 2.500.5 3.500-.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "brb":
      return (
        <svg {...common}>
          <path d="M1 3h8a3.5 3.5 0 0 1 0 7H1Zm0 7h9.500a3 3 0 0 1 0 6H1Z" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "safra":
      return (
        <svg {...common}>
          <path d="M8 1l7 7-7 7-7-7Z" fill="none" stroke="#d4af5a" strokeWidth="1.8" />
          <path d="M8 5l3 3-3 3-3-3Z" fill="#d4af5a" />
        </svg>
      );
    case "sicredi":
      return (
        <svg {...common}>
          <path d="M2 14C2 7 7 2 14 2c0 7-5 12-12 12Z" fill="currentColor" />
          <path d="M3 13c3-4 5-6 8-8" fill="none" stroke="#2e9b3f" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function BankMark({ bank }: { bank: Bank }) {
  return (
    <span className={`bank-mark bank-${bank.id}`} aria-hidden="true">
      <BankGlyph id={bank.id} />
      {BANK_LABEL[bank.id] ?? bank.name}
    </span>
  );
}

function NetworkMark({ network }: { network: Network }) {
  const base = { className: `network-mark network-${network}`, "aria-hidden": true } as const;
  switch (network) {
    case "mastercard":
      return (
        <svg {...base} width="38" height="24" viewBox="0 0 38 24">
          <circle cx="13" cy="12" r="11" fill="#eb001b" />
          <circle cx="25" cy="12" r="11" fill="#f79e1b" />
          <path d="M19 3.100a11 11 0 0 1 0 17.8 11 11 0 0 1 0-17.800Z" fill="#ff5f00" />
        </svg>
      );
    case "visa":
      return (
        <svg {...base} width="46" height="16" viewBox="0 0 46 16">
          <text x="23" y="14" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontWeight="800" fontSize="17" letterSpacing="-0.5" fill="currentColor">
            VISA
          </text>
          <path d="M2 15.500h42" stroke="#f7b600" strokeWidth="1.3" />
        </svg>
      );
    case "elo":
      return (
        <svg {...base} width="40" height="22" viewBox="0 0 40 22">
          <text x="0" y="17" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="19" letterSpacing="-1.2" fill="currentColor">
            el
          </text>
          <circle cx="29.5" cy="12.5" r="6.5" fill="#ffcb05" />
          <path d="M29.5 6a6.5 6.5 0 0 1 0 13" fill="none" stroke="#00a4e0" strokeWidth="3" />
          <path d="M23.5 12.500a6 6 0 0 0 6 6.5" fill="none" stroke="#ef4123" strokeWidth="3" />
        </svg>
      );
    case "amex":
      return (
        <svg {...base} width="40" height="26" viewBox="0 0 40 26">
          <rect width="40" height="26" rx="4" fill="#1f72cd" />
          <text x="20" y="17" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="10" letterSpacing="0.4" fill="#fff">
            AMEX
          </text>
        </svg>
      );
    case "hipercard":
      return (
        <svg {...base} width="46" height="22" viewBox="0 0 46 22">
          <rect width="46" height="22" rx="4" fill="#b3131b" />
          <text x="23" y="15" textAnchor="middle" fontFamily="system-ui, sans-serif" fontStyle="italic" fontWeight="800" fontSize="10.5" fill="#fff">
            Hipercard
          </text>
        </svg>
      );
  }
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
