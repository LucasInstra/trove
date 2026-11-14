/** Ready-made looks for a card, modelled on the cards people actually carry. */
export type CardTexture = "plain" | "waves" | "carbon" | "metal" | "glow" | "stripes";

export type CardDesign = {
  id: string;
  name: string;
  color: string;
  texture: CardTexture;
};

export const CARD_DESIGNS: CardDesign[] = [
  { id: "blue", name: "Azul Trove", color: "#1846e1", texture: "glow" },
  { id: "metal", name: "Grafite metálico", color: "#3a3f4b", texture: "metal" },
  { id: "carbon", name: "Preto carbono", color: "#16161a", texture: "carbon" },
  { id: "violet", name: "Roxo digital", color: "#8a05be", texture: "waves" },
  { id: "orange", name: "Laranja clássico", color: "#ec7000", texture: "glow" },
  { id: "red", name: "Vermelho banco", color: "#cc092f", texture: "stripes" },
  { id: "gold", name: "Dourado", color: "#a67c1f", texture: "metal" },
  { id: "green", name: "Verde", color: "#0b7a4b", texture: "waves" },
  { id: "plain", name: "Liso", color: "#2b2b2d", texture: "plain" },
];

/** The design whose colour and texture match, if the card still wears one. */
export function designOf(color: string, texture: string): string | null {
  const match = CARD_DESIGNS.find(
    (design) => design.color.toLowerCase() === color.toLowerCase() && design.texture === texture,
  );
  return match?.id ?? null;
}
