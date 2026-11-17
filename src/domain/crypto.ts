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
