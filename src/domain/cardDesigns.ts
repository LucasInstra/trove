/**
 * Ready-made looks for a card. The generic ones come first; the banks follow, each with the
 * versions of its card people carry in Brazil. The banks are drawn from scratch (colour,
 * pattern and a styled name, no official artwork), so a card reads as "that bank" without
 * copying its logo.
 */
type GenericTexture = "plain" | "waves" | "carbon" | "metal" | "glow" | "stripes";

export type CardDesign = {
  id: string;
  name: string;
  color: string;
  /** Stored on the card; the stylesheet draws it. Bank looks are named "<bank>" or "<bank>-<version>". */
  texture: string;
};

export type Bank = {
  id: string;
  name: string;
  /** Words in a card or account name that point at this bank. */
  match: RegExp;
  /** The versions of the card, the standard one first. */
  variants: CardDesign[];
};

const generic = (id: string, name: string, color: string, texture: GenericTexture): CardDesign => ({
  id,
  name,
  color,
  texture,
});

const look = (id: string, name: string, color: string, texture = id): CardDesign => ({ id, name, color, texture });

export const CARD_DESIGNS: CardDesign[] = [
  generic("blue", "Azul Trove", "#1846e1", "glow"),
  generic("metal", "Grafite metálico", "#3a3f4b", "metal"),
  generic("carbon", "Preto carbono", "#16161a", "carbon"),
  generic("violet", "Roxo digital", "#8a05be", "waves"),
  generic("orange", "Laranja clássico", "#ec7000", "glow"),
  generic("red", "Vermelho banco", "#cc092f", "stripes"),
  generic("gold", "Dourado", "#a67c1f", "metal"),
  generic("green", "Verde", "#0b7a4b", "waves"),
  generic("plain", "Liso", "#2b2b2d", "plain"),
];

export const BANKS: Bank[] = [
  {
    id: "nubank",
    name: "Nubank",
    match: /\bnu\b|nubank/,
    variants: [look("nubank", "Nubank", "#820ad1"), look("nubank-ultra", "Ultravioleta", "#17171b")],
  },
  {
    id: "itau",
    name: "Itaú",
    match: /ita[uú]/,
    variants: [
      look("itau", "Clássico", "#ec7000"),
      look("itau-platinum", "Platinum", "#aeb4bc"),
      look("itau-black", "Black", "#121212"),
      look("itau-personnalite", "Personnalité", "#1b1b1e"),
    ],
  },
  {
    id: "santander",
    name: "Santander",
    match: /santander/,
    variants: [
      look("santander", "Free", "#ec0000"),
      look("santander-silver", "Select", "#b9bec6"),
      look("santander-black", "Unlimited", "#121212"),
    ],
  },
  {
    id: "bradesco",
    name: "Bradesco",
    match: /bradesco/,
    variants: [look("bradesco", "Clássico", "#cc092f"), look("bradesco-prime", "Prime", "#1c1c20"), look("bradesco-aeternum", "Aeternum", "#0c0c0e")],
  },
  {
    id: "caixa",
    name: "Caixa",
    match: /caixa|\bcef\b/,
    variants: [look("caixa", "Clássico", "#005ca9"), look("caixa-graphite", "Grafite", "#2c3138")],
  },
  {
    id: "inter",
    name: "Inter",
    match: /\binter\b/,
    variants: [look("inter", "Laranja", "#ff7a00"), look("inter-prime", "Prime", "#2a2a2c"), look("inter-black", "Black", "#151515")],
  },
  {
    id: "picpay",
    name: "PicPay",
    match: /pic\s?pay/,
    variants: [look("picpay", "Verde", "#11c76f"), look("picpay-black", "Black", "#141816")],
  },
  {
    id: "c6",
    name: "C6 Bank",
    match: /\bc6\b/,
    variants: [look("c6", "Carbon", "#1b1b1d"), look("c6-platinum", "Platinum", "#a7adb5")],
  },
  {
    id: "bb",
    name: "Banco do Brasil",
    match: /banco do brasil|\bbb\b|ourocard/,
    variants: [look("bb", "Ourocard", "#fae128"), look("bb-infinite", "Infinite", "#0a2a73")],
  },
  {
    id: "mp",
    name: "Mercado Pago",
    match: /mercado\s?pago/,
    variants: [look("mp", "Azul", "#009ee3"), look("mp-black", "Preto", "#151a1f")],
  },
  {
    id: "brb",
    name: "BRB",
    match: /\bbrb\b/,
    variants: [look("brb", "Clássico", "#0a4aa6"), look("brb-dux", "Dux", "#14161b")],
  },
  {
    id: "safra",
    name: "Safra",
    match: /safra/,
    variants: [look("safra", "Clássico", "#0a2a5e"), look("safra-black", "Black", "#101012")],
  },
  {
    id: "sicredi",
    name: "Sicredi",
    match: /sicredi/,
    variants: [look("sicredi", "Clássico", "#2e9b3f"), look("sicredi-black", "Black", "#111513")],
  },
  {
    id: "xp",
    name: "XP",
    match: /\bxp\b/,
    variants: [look("xp", "Infinite", "#111111")],
  },
];

const EVERY_DESIGN: CardDesign[] = [...CARD_DESIGNS, ...BANKS.flatMap((bank) => bank.variants)];

/** The design whose colour and texture match, if the card still wears one. */
export function designOf(color: string, texture: string): string | null {
  const match = EVERY_DESIGN.find(
    (design) => design.color.toLowerCase() === color.toLowerCase() && design.texture === texture,
  );
  return match?.id ?? null;
}

/** The bank a stored texture belongs to ("itau-black" is Itaú), if it is a bank look. */
export function bankByTexture(texture: string): Bank | null {
  return BANKS.find((bank) => bank.variants.some((variant) => variant.texture === texture)) ?? null;
}

/** The bank a card name points at ("Itaú Click", "nubank roxinho"), if any. */
export function bankForName(name: string): Bank | null {
  const text = name.toLowerCase();
  return BANKS.find((bank) => bank.match.test(text)) ?? null;
}

/** The standard look of the bank a name points at. */
export function designForName(name: string): CardDesign | null {
  return bankForName(name)?.variants[0] ?? null;
}
