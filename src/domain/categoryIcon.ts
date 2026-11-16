/**
 * The 3D picture each seeded category wears, by its stored (English) name. The
 * files live in `assets/icons3d/set2/`. A category with no entry, such as one the
 * person created, keeps the letter bubble.
 */
const BY_SEED: Record<string, string> = {
  Groceries: "cat-groceries",
  Food: "cat-dining",
  Transport: "cat-car",
  Housing: "cat-home-bills",
  Health: "cat-health",
  Education: "cat-education",
  Leisure: "cat-leisure",
  Subscriptions: "cat-subscriptions",
  Taxes: "acc-percent",
  Salary: "tx-income",
  Transfer: "tx-transfer",
};

export function categoryIconName(name: string | null | undefined): string | null {
  return (name && BY_SEED[name]) || null;
}
