export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export const RARITY_ORDER: Rarity[] = [
  "Legendary",
  "Epic",
  "Rare",
  "Uncommon",
  "Common",
];

export const RARITY_COUNT: Record<Rarity, number> = {
  Common: 3055,
  Uncommon: 1389,
  Rare: 667,
  Epic: 333,
  Legendary: 111,
};

export const TOTAL_SUPPLY = 5555;
export const FREE_SUPPLY = 1111;
export const PAID_SUPPLY = 4444;
export const PAID_PRICE_BNB = 0.001;
export const MAX_FREE_PER_WALLET = 1;
export const MAX_PAID_PER_WALLET = 10;

/** Tailwind classes per rarity (static strings so Tailwind can detect them). */
export const RARITY_BADGE: Record<Rarity, string> = {
  Common: "bg-cyan-400/10 text-visor-cyan border-cyan-400/30",
  Uncommon: "bg-emerald-400/10 text-visor-emerald border-emerald-400/30",
  Rare: "bg-violet-400/10 text-visor-violet border-violet-400/30",
  Epic: "bg-pink-400/10 text-visor-magenta border-pink-400/30",
  Legendary: "bg-yellow-400/15 text-aurum-gold border-yellow-400/50",
};

export const RARITY_DOT: Record<Rarity, string> = {
  Common: "#35e0ff",
  Uncommon: "#2eea8a",
  Rare: "#a855f7",
  Epic: "#ff5c8a",
  Legendary: "#ffd700",
};

export interface GalleryToken {
  id: number;
  rarity: Rarity;
  edition: "Standard" | "Aurum Gold";
  background: string;
  plating: string;
  eyes: string;
  accessory: string;
  glow: string;
  effect: string;
}
