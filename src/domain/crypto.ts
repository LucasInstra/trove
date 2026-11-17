/** Coins the app can price, by symbol (the price service ids live in the backend). */
export const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "LTC", "USDT", "USDC"] as const;

/** Setting key holding the choice: missing = never asked, "on" or "off". */
export const CRYPTO_SETTING = "crypto_enabled";

/** Raised after the choice changes so the app can start or stop fetching prices. */
export const CRYPTO_EVENT = "trove:crypto";

/** Display names, used to fill the holding name when a coin is picked. */
export const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  LTC: "Litecoin",
  USDT: "Tether",
  USDC: "USD Coin",
};

export interface CryptoResult {
  /** What was paid. */
  costCents: number;
  /** What it is worth now. */
  valueCents: number;
  /** Value minus cost: positive is a gain. */
  gainCents: number;
  /** Gain over cost, in percent with one decimal; null when nothing was paid in. */
  pct: number | null;
}

/** Gain or loss of one crypto holding, or of several together, against what was paid. */
export function cryptoResult(holdings: { costCents: number; amountCents: number }[]): CryptoResult {
  const costCents = holdings.reduce((sum, holding) => sum + holding.costCents, 0);
  const valueCents = holdings.reduce((sum, holding) => sum + holding.amountCents, 0);
  const gainCents = valueCents - costCents;
  return {
    costCents,
    valueCents,
    gainCents,
    pct: costCents > 0 ? Math.round((gainCents / costCents) * 1000) / 10 : null,
  };
}
