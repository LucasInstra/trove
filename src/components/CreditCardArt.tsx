import type { CSSProperties } from "react";
import type { CardMeta } from "../lib/api";
import { useLanguage } from "../lib/language";
import { Icon } from "./Icons";

/** A card drawn like the real thing: chip, number, holder and the two dates. */
export function CreditCardArt({ meta, status }: { meta: CardMeta; status?: string }) {
  const { t } = useLanguage();
  const gradient = `chip-art-${meta.id}`;
  return (
    <div
      className="card-art-real"
      style={{ "--card-color": meta.color } as CSSProperties}
      role="img"
      aria-label={`${meta.brand || t("planner.card")} •••• ${meta.last4 || "0000"}`}
    >
      <span className="card-art-top">
        <span className="card-art-brand">{meta.brand || t("planner.card")}</span>
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
        </span>
        <span className="card-art-field end">
          <small>{t("planner.closesDayShort", { day: meta.closingDay })}</small>
          <small>{t("planner.dueDayShort", { day: meta.dueDay })}</small>
        </span>
      </span>
    </div>
  );
}
